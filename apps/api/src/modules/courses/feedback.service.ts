import type { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { averageRating, MIN_AVERAGE, MIN_RATINGS, qualifies } from '../../services/matching/teachingEvidence.js';
import type { feedbackSchema } from './courses.schemas.js';
import { type Actor, canManage } from './courses.service.js';

// A trainee rates a course once (they can change it later). Only after enrolling.
export async function saveFeedback(userId: string, courseId: string, input: z.infer<typeof feedbackSchema>) {
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!enrollment || enrollment.status === 'DROPPED') throw AppError.forbidden('Enrol in the course before giving feedback');

  return prisma.$transaction(async (tx) => {
    const feedback = await tx.feedback.upsert({
      where: { courseId_userId: { courseId, userId } },
      update: { rating: input.rating, comment: input.comment ?? null },
      create: { courseId, userId, rating: input.rating, comment: input.comment ?? null },
    });
    await audit(tx, { actorId: userId, action: 'FEEDBACK_GIVEN', entityType: 'Course', entityId: courseId, metadata: { rating: input.rating } });
    return feedback;
  });
}

// Trainer / admin: summary + comments. Comments are shown without names, so trainees
// can be honest. Trainees only get their own feedback back.
export async function getFeedback(actor: Actor, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw AppError.notFound('Course not found');

  if (!canManage(actor, course)) {
    const mine = await prisma.feedback.findUnique({ where: { courseId_userId: { courseId, userId: actor.id } } });
    return { mine: mine && { rating: mine.rating, comment: mine.comment, updatedAt: mine.createdAt } };
  }

  const all = await prisma.feedback.findMany({ where: { courseId }, orderBy: { createdAt: 'desc' } });
  const ratings = all.map((f) => f.rating);
  return {
    count: all.length,
    average: all.length ? Math.round(averageRating(ratings) * 10) / 10 : null,
    distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: ratings.filter((r) => r === stars).length })),
    comments: all.filter((f) => f.comment).map((f) => ({ id: f.id, rating: f.rating, comment: f.comment, createdAt: f.createdAt })),
    // How this course's feedback feeds trainer matching (services/matching/teachingEvidence.ts)
    teachingEvidence: {
      counts: qualifies(ratings),
      minRatings: MIN_RATINGS,
      minAverage: MIN_AVERAGE,
    },
  };
}
