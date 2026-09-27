import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

// Enrols a trainee in a published course, respecting its capacity.
//
// The course row is locked (SELECT ... FOR UPDATE) while seats are counted, so two
// trainees clicking "Enrol" for the last seat at the same moment cannot both get it.
export async function enroll(userId: string, courseId: string) {
  return prisma.$transaction(async (tx) => {
    const [course] = await tx.$queryRaw<{ id: string; status: string; capacity: number | null; endDate: Date | null }[]>`
      SELECT id, status, capacity, "endDate" FROM "Course" WHERE id = ${courseId} FOR UPDATE`;
    if (!course || course.status !== 'PUBLISHED') throw AppError.notFound('Course not found');
    if (course.endDate && course.endDate < new Date()) throw AppError.conflict('This course has already ended');

    const existing = await tx.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (existing && existing.status !== 'DROPPED') throw AppError.conflict('You are already enrolled in this course');

    if (course.capacity !== null) {
      const taken = await tx.enrollment.count({ where: { courseId, status: { not: 'DROPPED' } } });
      if (taken >= course.capacity) throw AppError.conflict('This course is full');
    }

    const enrollment = existing
      ? await tx.enrollment.update({ where: { id: existing.id }, data: { status: 'ENROLLED', enrolledAt: new Date(), completedAt: null } })
      : await tx.enrollment.create({ data: { userId, courseId } });
    await audit(tx, { actorId: userId, action: 'ENROLLED', entityType: 'Course', entityId: courseId });
    return enrollment;
  });
}

// "My courses": everything the trainee is enrolled in, newest first.
export function myCourses(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId, status: { not: 'DROPPED' } },
    include: {
      course: {
        include: {
          subject: { select: { name: true } },
          trainer: { select: { fullName: true } },
          competencies: { include: { competency: { select: { id: true, name: true } } } },
          _count: { select: { modules: true } },
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });
}
