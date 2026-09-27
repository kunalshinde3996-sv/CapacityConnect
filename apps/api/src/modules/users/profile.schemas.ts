import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional();
// Multipart form fields arrive as strings; empty string means "not given".
const optionalDate = z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.coerce.date().optional());
const optionalYear = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v),
  z.coerce.number().int().min(1950).max(2100).optional(),
);

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: optionalText(20),
  designation: optionalText(100),
  bio: optionalText(1000),
  interests: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  // Trainer-only fields (ignored for trainees)
  headline: optionalText(150),
  yearsOfExperience: z.number().int().min(0).max(60).optional(),
});

export const qualificationSchema = z.object({
  degree: z.string().trim().min(1).max(60),
  fieldOfStudy: z.string().trim().min(1).max(120),
  institution: z.string().trim().min(1).max(150),
  yearCompleted: optionalYear,
});

export const experienceSchema = z
  .object({
    organisation: z.string().trim().min(1).max(150),
    title: z.string().trim().min(1).max(120),
    startDate: z.coerce.date(),
    endDate: optionalDate,
    description: optionalText(1000),
  })
  .refine((e) => !e.endDate || e.endDate >= e.startDate, { message: 'End date cannot be before start date', path: ['endDate'] });

export const certificateSchema = z.object({
  title: z.string().trim().min(1).max(150),
  issuer: z.string().trim().min(1).max(150),
  issuedOn: optionalDate,
  expiresOn: optionalDate,
});

// Skills are picked from the competency framework, never typed as free text.
export const skillsSchema = z.object({
  skills: z
    .array(z.object({ competencyId: z.string().min(1), level: z.number().int().min(1).max(4) }))
    .max(40)
    .refine((list) => new Set(list.map((s) => s.competencyId)).size === list.length, 'Each competency can be listed once'),
});

export const applicationSchema = z.object({
  motivation: z.string().trim().min(30, 'Tell the admin a bit more (at least 30 characters)').max(2000),
});
