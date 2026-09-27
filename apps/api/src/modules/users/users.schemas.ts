import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'DISABLED']).optional(),
  role: z.enum(['TRAINEE', 'TRAINER', 'ADMIN']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const reasonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const changeRoleSchema = z.object({
  role: z.enum(['TRAINEE', 'TRAINER', 'ADMIN']),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
