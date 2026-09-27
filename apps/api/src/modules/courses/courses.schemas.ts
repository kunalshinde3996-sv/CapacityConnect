import { z } from 'zod';

const optionalDate = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date().optional());

const competencyTargets = z
  .array(z.object({ competencyId: z.string().min(1), targetLevel: z.number().int().min(1).max(4) }))
  .max(12)
  .refine((list) => new Set(list.map((c) => c.competencyId)).size === list.length, 'Each competency can be tagged once');

const courseFields = {
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(4000),
  subjectId: z.string().min(1).nullable().optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  capacity: z.number().int().min(1).max(1000).nullable().optional(),
  competencies: competencyTargets.optional(),
};

const datesInOrder = (c: { startDate?: Date; endDate?: Date }) => !c.startDate || !c.endDate || c.endDate >= c.startDate;
const datesMessage = { message: 'End date cannot be before start date', path: ['endDate'] };

export const createCourseSchema = z.object(courseFields).refine(datesInOrder, datesMessage);
export const updateCourseSchema = z.object(courseFields).partial().refine(datesInOrder, datesMessage);

export const listCoursesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  subjectId: z.string().optional(),
  competencyId: z.string().optional(),
  // "mine": courses the signed-in trainer teaches or created (any status)
  mine: z.enum(['true', 'false']).optional(),
  // admin only: include drafts and archived courses
  all: z.enum(['true', 'false']).optional(),
});

export const moduleSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional(),
});

export const moveModuleSchema = z.object({ direction: z.enum(['UP', 'DOWN']) });
export const assignTrainerSchema = z.object({ trainerId: z.string().min(1) });

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
