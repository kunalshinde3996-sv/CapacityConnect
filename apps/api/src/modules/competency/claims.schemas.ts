import { z } from 'zod';

const optionalId = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional());

// Sent as a multipart form (an evidence file is optional), so numbers arrive as strings.
export const claimSchema = z
  .object({
    competencyId: z.string().min(1),
    level: z.coerce.number().int().min(1).max(4),
    evidenceType: z.enum(['CERTIFICATE', 'QUALIFICATION', 'EXPERIENCE', 'TEACHING', 'SELF_DECLARED']),
    evidenceNote: z.string().trim().max(500).optional(),
    certificateId: optionalId,
    qualificationId: optionalId,
  })
  .superRefine((c, ctx) => {
    if (c.evidenceType === 'CERTIFICATE' && !c.certificateId) {
      ctx.addIssue({ code: 'custom', path: ['certificateId'], message: 'Pick the certificate that proves this claim' });
    }
    if (c.evidenceType === 'QUALIFICATION' && !c.qualificationId) {
      ctx.addIssue({ code: 'custom', path: ['qualificationId'], message: 'Pick the qualification that proves this claim' });
    }
  });

export const reviewSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((r) => r.decision === 'APPROVE' || (r.reason && r.reason.length >= 5), {
    message: 'Give a short reason when rejecting',
    path: ['reason'],
  });

export type ClaimInput = z.infer<typeof claimSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
