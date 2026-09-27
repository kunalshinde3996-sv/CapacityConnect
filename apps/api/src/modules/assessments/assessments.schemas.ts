import { z } from 'zod';

// The trainer sends options as plain strings plus the index of the correct one;
// the server turns them into [{ id: 'a', text }, ...] and stores the correct option id.
export const questionInputSchema = z
  .object({
    text: z.string().trim().min(5).max(1000),
    competencyId: z.string().min(1),
    options: z.array(z.string().trim().min(1).max(300)).min(2, 'At least 2 options').max(6, 'At most 6 options'),
    correctIndex: z.number().int().min(0),
    marks: z.number().int().min(1).max(10).default(1),
    explanation: z.string().trim().max(1000).optional(),
  })
  .refine((q) => q.correctIndex < q.options.length, { message: 'Pick which option is correct', path: ['correctIndex'] })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, {
    message: 'Options must be different from each other',
    path: ['options'],
  });

export const assessmentInputSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(2000).optional(),
  deadline: z.coerce.date(),
  durationMinutes: z.number().int().min(5).max(300).nullable().optional(),
  passPercent: z.number().int().min(0).max(100).default(50),
  questions: z.array(questionInputSchema).min(1, 'Add at least one question').max(50),
});

// { answers: { [questionId]: optionId } } - blanks may be omitted
export const submitSchema = z.object({
  answers: z.record(z.string(), z.string().max(10).nullable()),
});

export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
