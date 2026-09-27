import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AnnouncementInput } from './notifications.schemas.js';

const authorSelect = { createdBy: { select: { fullName: true } } } as const;

// Public homepage feed: published announcements plus the newest learning content.
export async function publicFeed() {
  const [announcements, courses, library] = await Promise.all([
    prisma.announcement.findMany({
      where: { published: true },
      orderBy: { publishedAt: 'desc' },
      take: 12,
      select: { id: true, type: true, title: true, body: true, linkUrl: true, publishedAt: true },
    }),
    prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { id: true, title: true, createdAt: true, subject: { select: { name: true } }, trainer: { select: { fullName: true } } },
    }),
    prisma.libraryItem.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { id: true, title: true, type: true, createdAt: true, uploadedBy: { select: { fullName: true } } },
    }),
  ]);
  return { announcements, newContent: { courses, library } };
}

export function listAll() {
  return prisma.announcement.findMany({ include: authorSelect, orderBy: [{ published: 'desc' }, { updatedAt: 'desc' }] });
}

export async function create(adminId: string, input: AnnouncementInput) {
  return prisma.$transaction(async (tx) => {
    // Created as a draft; publishing is a separate, deliberate step.
    const a = await tx.announcement.create({ data: { ...input, linkUrl: input.linkUrl ?? null, createdById: adminId }, include: authorSelect });
    await audit(tx, { actorId: adminId, action: 'ANNOUNCEMENT_CREATED', entityType: 'Announcement', entityId: a.id });
    return a;
  });
}

export async function update(adminId: string, id: string, input: AnnouncementInput) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.announcement.updateMany({ where: { id }, data: { ...input, linkUrl: input.linkUrl ?? null } });
    if (count === 0) throw AppError.notFound('Announcement not found');
    await audit(tx, { actorId: adminId, action: 'ANNOUNCEMENT_UPDATED', entityType: 'Announcement', entityId: id });
    return tx.announcement.findUniqueOrThrow({ where: { id }, include: authorSelect });
  });
}

export async function setPublished(adminId: string, id: string, published: boolean) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.announcement.updateMany({
      where: { id },
      data: published ? { published: true, publishedAt: new Date() } : { published: false },
    });
    if (count === 0) throw AppError.notFound('Announcement not found');
    await audit(tx, { actorId: adminId, action: published ? 'ANNOUNCEMENT_PUBLISHED' : 'ANNOUNCEMENT_UNPUBLISHED', entityType: 'Announcement', entityId: id });
    return tx.announcement.findUniqueOrThrow({ where: { id }, include: authorSelect });
  });
}
