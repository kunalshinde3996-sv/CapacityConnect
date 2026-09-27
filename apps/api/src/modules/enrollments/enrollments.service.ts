import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { notify } from '../notifications/notifications.service.js';

// Enrols a trainee in a published course, respecting its capacity.
//
// The course row is locked (SELECT ... FOR UPDATE) while seats are counted, so two
// trainees clicking "Enrol" for the last seat at the same moment cannot both get it.
export async function enroll(userId: string, courseId: string) {
  const enrollment = await enrollInTransaction(userId, courseId);
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { title: true } });
  await notify([userId], {
    type: 'ENROLMENT_CONFIRMED',
    title: `Enrolled: ${course.title}`,
    body: `You are enrolled in "${course.title}". Its materials and assessments are on the course page.`,
    link: `/courses/${courseId}`,
  });
  return enrollment;
}

function enrollInTransaction(userId: string, courseId: string) {
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

// The course trainer (or an admin) marks a trainee's course as completed. This also records
// a certificate issued by Capacity Connect (courseId set, VERIFIED at once, since the platform
// itself is the issuer). Completion does not change skill levels: assessments stay the only
// measured source.
export async function completeEnrollment(actor: { id: string; role: string }, courseId: string, userId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw AppError.notFound('Course not found');
  if (actor.role !== 'ADMIN' && course.trainerId !== actor.id && course.createdById !== actor.id) {
    throw AppError.forbidden('Only the course trainer or an admin can mark completions');
  }

  return prisma.$transaction(async (tx) => {
    // Only an ENROLLED (not yet completed) enrolment can be completed, even if two clicks race.
    const { count } = await tx.enrollment.updateMany({
      where: { userId, courseId, status: 'ENROLLED' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (count === 0) {
      const existing = await tx.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
      throw existing ? AppError.conflict('This enrolment is already completed or was dropped') : AppError.notFound('This trainee is not enrolled');
    }
    const certificate = await tx.certificate.create({
      data: {
        userId,
        courseId,
        title: `Course completion: ${course.title}`,
        issuer: 'Capacity Connect (MoES)',
        issuedOn: new Date(),
        status: 'VERIFIED',
        verifiedById: actor.id,
        verifiedAt: new Date(),
      },
    });
    await audit(tx, { actorId: actor.id, action: 'COURSE_COMPLETED', entityType: 'Enrollment', entityId: `${courseId}:${userId}`, metadata: { certificateId: certificate.id } });
    return tx.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId, courseId } } });
  });
}
