import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { createFileLink } from '../storage/fileLinks.js';
import { storage } from '../storage/storage.service.js';
import { storeUpload, type Upload } from '../storage/upload.middleware.js';
import { type Actor, canManage } from './courses.service.js';
import { type CreateLibraryItemInput, KINDS_FOR_TYPE, type libraryQuerySchema, type UpdateLibraryItemInput } from './library.schemas.js';

// A video link must outlive a long lecture: the browser keeps requesting chunks
// (Range requests) with the same URL while the video plays.
const LIBRARY_LINK_TTL_SECONDS = 2 * 60 * 60;

const itemInclude = {
  uploadedBy: { select: { id: true, fullName: true, institute: { select: { code: true } } } },
  course: { select: { id: true, title: true } },
  module: { select: { id: true, title: true, order: true } },
  competencies: { include: { competency: { select: { id: true, name: true, category: true } } } },
} satisfies Prisma.LibraryItemInclude;

type ItemWithRelations = Prisma.LibraryItemGetPayload<{ include: typeof itemInclude }>;

// Never expose storage keys: the client gets a flag and asks for a signed link.
function toDto({ fileKey, ...item }: ItemWithRelations) {
  return { ...item, hasFile: Boolean(fileKey) };
}

const canEdit = (actor: Actor, item: { uploadedById: string }) => actor.role === 'ADMIN' || item.uploadedById === actor.id;

export async function listItems(actor: Actor, query: z.infer<typeof libraryQuerySchema>) {
  const conditions: Prisma.LibraryItemWhereInput[] = [
    // Unpublished items are visible only to whoever uploaded them (and admins).
    query.mine === 'true' ? { uploadedById: actor.id } : actor.role === 'ADMIN' ? {} : { OR: [{ isPublished: true }, { uploadedById: actor.id }] },
  ];
  if (query.type) conditions.push({ type: query.type });
  if (query.courseId) conditions.push({ courseId: query.courseId });
  if (query.competencyId) conditions.push({ competencies: { some: { competencyId: query.competencyId } } });
  if (query.q) {
    conditions.push({
      OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }],
    });
  }
  const items = await prisma.libraryItem.findMany({
    where: { AND: conditions },
    include: itemInclude,
    orderBy: [{ course: { title: 'asc' } }, { module: { order: 'asc' } }, { createdAt: 'desc' }],
  });
  return items.map(toDto);
}

export async function getItem(actor: Actor, id: string) {
  const item = await prisma.libraryItem.findUnique({ where: { id }, include: itemInclude });
  if (!item || (!item.isPublished && !canEdit(actor, item))) throw AppError.notFound('Library item not found');
  return toDto(item);
}

export async function fileLink(actor: Actor, id: string) {
  const item = await prisma.libraryItem.findUnique({ where: { id } });
  if (!item?.fileKey || (!item.isPublished && !canEdit(actor, item))) throw AppError.notFound('File not found');
  const ext = item.fileKey.slice(item.fileKey.lastIndexOf('.'));
  return createFileLink(item.fileKey, `${item.title}${ext}`, LIBRARY_LINK_TTL_SECONDS);
}

export async function createItem(actor: Actor, input: CreateLibraryItemInput, upload: Upload) {
  // The file must fit the chosen type (e.g. a VIDEO must be an MP4).
  if (!KINDS_FOR_TYPE[input.type].includes(upload.kind)) {
    const allowed = KINDS_FOR_TYPE[input.type].map((k) => `.${k}`).join(' or ');
    throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', `A ${input.type.toLowerCase()} must be a ${allowed} file`);
  }
  await checkLinks(actor, input);

  const file = await storeUpload(upload, 'library');
  return prisma.$transaction(async (tx) => {
    const item = await tx.libraryItem.create({
      data: {
        title: input.title,
        description: input.description,
        type: input.type,
        fileKey: file.fileKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        uploadedById: actor.id,
        courseId: input.courseId ?? null,
        moduleId: input.moduleId ?? null,
        competencies: { create: input.competencyIds.map((competencyId) => ({ competencyId })) },
      },
      include: itemInclude,
    });
    await audit(tx, { actorId: actor.id, action: 'LIBRARY_ITEM_UPLOADED', entityType: 'LibraryItem', entityId: item.id });
    return toDto(item);
  });
}

export async function updateItem(actor: Actor, id: string, input: UpdateLibraryItemInput) {
  const item = await prisma.libraryItem.findUnique({ where: { id } });
  if (!item || !canEdit(actor, item)) throw AppError.notFound('Library item not found');
  const courseId = input.courseId === undefined ? item.courseId : input.courseId;
  const moduleId = input.moduleId === undefined ? (input.courseId === null ? null : item.moduleId) : input.moduleId;
  await checkLinks(actor, { courseId, moduleId, competencyIds: input.competencyIds });

  const { competencyIds, ...fields } = input;
  return prisma.$transaction(async (tx) => {
    if (competencyIds) {
      await tx.libraryItemCompetency.deleteMany({ where: { libraryItemId: id } });
      await tx.libraryItemCompetency.createMany({ data: competencyIds.map((competencyId) => ({ libraryItemId: id, competencyId })) });
    }
    const updated = await tx.libraryItem.update({ where: { id }, data: { ...fields, courseId, moduleId }, include: itemInclude });
    return toDto(updated);
  });
}

export async function deleteItem(actor: Actor, id: string) {
  const item = await prisma.libraryItem.findUnique({ where: { id } });
  if (!item || !canEdit(actor, item)) throw AppError.notFound('Library item not found');
  await prisma.$transaction(async (tx) => {
    await tx.libraryItem.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: 'LIBRARY_ITEM_DELETED', entityType: 'LibraryItem', entityId: id, metadata: { title: item.title } });
  });
  // Demo files are shared by the seed; only remove files that were really uploaded.
  if (item.fileKey && !item.fileKey.startsWith('demo/')) await storage.delete(item.fileKey);
}

// A course link needs a course the uploader manages; a module must belong to that course.
async function checkLinks(actor: Actor, input: { courseId?: string | null; moduleId?: string | null; competencyIds?: string[] }) {
  if (input.moduleId && !input.courseId) throw AppError.badRequest('Choose the course before the module');
  if (input.courseId) {
    const course = await prisma.course.findUnique({ where: { id: input.courseId } });
    if (!course) throw AppError.badRequest('Unknown course');
    if (!canManage(actor, course)) throw AppError.forbidden('You can only add material to courses you teach');
  }
  if (input.moduleId) {
    const module = await prisma.courseModule.findFirst({ where: { id: input.moduleId, courseId: input.courseId! } });
    if (!module) throw AppError.badRequest('That module is not part of the course');
  }
  if (input.competencyIds) {
    const found = await prisma.competency.count({ where: { id: { in: input.competencyIds }, isActive: true } });
    if (found !== input.competencyIds.length) throw AppError.badRequest('One or more competencies do not exist');
  }
}
