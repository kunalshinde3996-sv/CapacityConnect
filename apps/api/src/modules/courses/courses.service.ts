import type { Prisma } from '../../generated/prisma/client.js';
import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { CreateCourseInput, UpdateCourseInput, listCoursesQuerySchema } from './courses.schemas.js';
import type { z } from 'zod';

export interface Actor {
  id: string;
  role: 'TRAINEE' | 'TRAINER' | 'ADMIN';
}

const summaryInclude = {
  subject: { select: { id: true, name: true } },
  trainer: { select: { id: true, fullName: true, designation: true, institute: { select: { code: true } } } },
  institute: { select: { code: true, name: true } },
  competencies: { include: { competency: { select: { id: true, name: true, category: true } } } },
  _count: { select: { modules: true, enrollments: { where: { status: { not: 'DROPPED' } } } } },
} satisfies Prisma.CourseInclude;

// Who may edit a course: its trainer, whoever created it, or an admin.
export function canManage(actor: Actor, course: { trainerId: string | null; createdById: string }) {
  return actor.role === 'ADMIN' || course.trainerId === actor.id || course.createdById === actor.id;
}

async function findManageable(actor: Actor, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw AppError.notFound('Course not found');
  if (!canManage(actor, course)) throw AppError.forbidden('Only the course trainer or an admin can change this course');
  return course;
}

export async function listCourses(actor: Actor, query: z.infer<typeof listCoursesQuerySchema>) {
  const mine = query.mine === 'true' && actor.role !== 'TRAINEE';
  // Each filter is its own condition, combined with AND (two of them use OR internally).
  const conditions: Prisma.CourseWhereInput[] = [
    mine
      ? { OR: [{ trainerId: actor.id }, { createdById: actor.id }] }
      : query.all === 'true' && actor.role === 'ADMIN'
        ? {}
        : { status: 'PUBLISHED' },
  ];
  if (query.subjectId) conditions.push({ subjectId: query.subjectId });
  if (query.competencyId) conditions.push({ competencies: { some: { competencyId: query.competencyId } } });
  if (query.q) {
    conditions.push({
      OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }],
    });
  }
  const where: Prisma.CourseWhereInput = { AND: conditions };

  const courses = await prisma.course.findMany({
    where,
    include: {
      ...summaryInclude,
      enrollments: { where: { userId: actor.id }, select: { status: true } },
    },
    orderBy: [{ status: 'asc' }, { startDate: 'asc' }, { title: 'asc' }],
  });
  return courses.map(({ enrollments, ...c }) => ({ ...c, myEnrollment: enrollments[0]?.status ?? null }));
}

export async function getCourse(actor: Actor, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      ...summaryInclude,
      modules: { orderBy: { order: 'asc' } },
      enrollments: { where: { userId: actor.id }, select: { status: true, enrolledAt: true } },
    },
  });
  // Drafts are invisible to everyone except the people who can edit them.
  if (!course || (course.status !== 'PUBLISHED' && !canManage(actor, course))) throw AppError.notFound('Course not found');

  const { enrollments, ...rest } = course;
  return { ...rest, myEnrollment: enrollments[0] ?? null, canManage: canManage(actor, course) };
}

export async function createCourse(actor: Actor, input: CreateCourseInput) {
  await checkReferences(input);
  const { competencies, ...fields } = input;
  const creator = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { instituteId: true } });

  return prisma.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        ...fields,
        createdById: actor.id,
        // A trainer who creates a course teaches it; an admin assigns a trainer later.
        trainerId: actor.role === 'TRAINER' ? actor.id : null,
        instituteId: creator.instituteId,
        competencies: competencies && { create: competencies },
      },
    });
    await audit(tx, { actorId: actor.id, action: 'COURSE_CREATED', entityType: 'Course', entityId: course.id });
    return course;
  });
}

export async function updateCourse(actor: Actor, courseId: string, input: UpdateCourseInput) {
  await findManageable(actor, courseId);
  await checkReferences(input);
  const { competencies, ...fields } = input;

  return prisma.$transaction(async (tx) => {
    if (competencies) {
      // Replace the tag set: remove what is gone, upsert the rest.
      await tx.courseCompetency.deleteMany({ where: { courseId, competencyId: { notIn: competencies.map((c) => c.competencyId) } } });
      for (const c of competencies) {
        await tx.courseCompetency.upsert({
          where: { courseId_competencyId: { courseId, competencyId: c.competencyId } },
          update: { targetLevel: c.targetLevel },
          create: { courseId, ...c },
        });
      }
    }
    return tx.course.update({ where: { id: courseId }, data: fields });
  });
}

// DRAFT -> PUBLISHED needs at least one module and one competency tag, so trainees
// never see an empty course and every course feeds the competency framework.
export async function setStatus(actor: Actor, courseId: string, status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT') {
  const course = await findManageable(actor, courseId);
  if (status === 'PUBLISHED') {
    const [modules, tags] = await Promise.all([
      prisma.courseModule.count({ where: { courseId } }),
      prisma.courseCompetency.count({ where: { courseId } }),
    ]);
    if (modules === 0 || tags === 0) {
      throw AppError.badRequest('Add at least one module and one competency before publishing');
    }
  }
  if (status === 'DRAFT' && course.status !== 'DRAFT') {
    const enrolled = await prisma.enrollment.count({ where: { courseId } });
    if (enrolled > 0) throw AppError.conflict('A course with enrolled trainees cannot go back to draft; archive it instead');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.course.update({ where: { id: courseId }, data: { status } });
    await audit(tx, {
      actorId: actor.id,
      action: `COURSE_${status}`,
      entityType: 'Course',
      entityId: courseId,
      metadata: { from: course.status, to: status },
    });
    return updated;
  });
}

// ── Modules ────────────────────────────────────────────────

export async function addModule(actor: Actor, courseId: string, input: { title: string; description?: string }) {
  await findManageable(actor, courseId);
  const last = await prisma.courseModule.findFirst({ where: { courseId }, orderBy: { order: 'desc' } });
  return prisma.courseModule.create({ data: { courseId, ...input, order: (last?.order ?? 0) + 1 } });
}

export async function updateModule(actor: Actor, courseId: string, moduleId: string, input: { title: string; description?: string }) {
  await findManageable(actor, courseId);
  const { count } = await prisma.courseModule.updateMany({ where: { id: moduleId, courseId }, data: input });
  if (count === 0) throw AppError.notFound('Module not found');
  return prisma.courseModule.findUniqueOrThrow({ where: { id: moduleId } });
}

export async function deleteModule(actor: Actor, courseId: string, moduleId: string) {
  const course = await findManageable(actor, courseId);
  if (course.status === 'PUBLISHED' && (await prisma.courseModule.count({ where: { courseId } })) === 1) {
    throw AppError.conflict('A published course needs at least one module');
  }
  const { count } = await prisma.courseModule.deleteMany({ where: { id: moduleId, courseId } });
  if (count === 0) throw AppError.notFound('Module not found');
}

// Swaps a module with its neighbour. (courseId, order) is unique, so the swap goes
// through a temporary order value inside one transaction.
export async function moveModule(actor: Actor, courseId: string, moduleId: string, direction: 'UP' | 'DOWN') {
  await findManageable(actor, courseId);
  const modules = await prisma.courseModule.findMany({ where: { courseId }, orderBy: { order: 'asc' } });
  const index = modules.findIndex((m) => m.id === moduleId);
  if (index === -1) throw AppError.notFound('Module not found');
  const other = modules[direction === 'UP' ? index - 1 : index + 1];
  if (!other) return modules; // already at the edge
  const current = modules[index]!;

  await prisma.$transaction([
    prisma.courseModule.update({ where: { id: current.id }, data: { order: -1 } }),
    prisma.courseModule.update({ where: { id: other.id }, data: { order: current.order } }),
    prisma.courseModule.update({ where: { id: current.id }, data: { order: other.order } }),
  ]);
  return prisma.courseModule.findMany({ where: { courseId }, orderBy: { order: 'asc' } });
}

// ── Admin: assign a trainer (from the trainer-matching page) ──

export async function assignTrainer(adminId: string, courseId: string, trainerId: string) {
  const [course, trainer] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.user.findUnique({ where: { id: trainerId } }),
  ]);
  if (!course) throw AppError.notFound('Course not found');
  if (!trainer || trainer.role !== 'TRAINER' || trainer.status !== 'APPROVED') {
    throw AppError.badRequest('Only an approved trainer can be assigned to a course');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.course.update({ where: { id: courseId }, data: { trainerId } });
    await audit(tx, {
      actorId: adminId,
      action: 'COURSE_TRAINER_ASSIGNED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { from: course.trainerId, to: trainerId },
    });
    return updated;
  });
}

async function checkReferences(input: { subjectId?: string | null; competencies?: { competencyId: string }[] }) {
  if (input.subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw AppError.badRequest('Unknown subject');
  }
  if (input.competencies?.length) {
    const ids = input.competencies.map((c) => c.competencyId);
    const found = await prisma.competency.count({ where: { id: { in: ids }, isActive: true } });
    if (found !== ids.length) throw AppError.badRequest('One or more competencies do not exist');
  }
}
