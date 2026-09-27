import type { Role } from '../generated/prisma/client.js';

// Adds `req.user` (set by requireAuth) to Express's Request type.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
        role: Role;
      };
    }
  }
}

export {};
