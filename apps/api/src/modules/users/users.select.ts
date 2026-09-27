import type { Prisma } from '../../generated/prisma/client.js';

// The only user fields the API ever sends to clients. Never includes passwordHash.
export const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  designation: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  institute: { select: { id: true, code: true, name: true } },
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
