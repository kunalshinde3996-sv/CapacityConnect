import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

export const registerSchema = z.object({
  email,
  // bcrypt only uses the first 72 bytes of a password, so cap it there.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password is too long'),
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  designation: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  instituteId: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
