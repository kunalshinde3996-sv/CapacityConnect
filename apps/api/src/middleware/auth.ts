import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/tokens.js';

// Checks the Bearer access token, then loads the user from the database.
// Loading the user (one small query) means a DISABLED account or a role change
// takes effect immediately, instead of waiting up to 15 minutes for the token to expire.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(AppError.unauthorized());

  let userId: string;
  try {
    userId = verifyAccessToken(header.slice('Bearer '.length)).sub;
  } catch {
    return next(new AppError(401, 'INVALID_TOKEN', 'Access token is invalid or expired'));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, role: true, status: true },
  });
  if (!user || user.status !== 'APPROVED') {
    return next(new AppError(401, 'ACCOUNT_INACTIVE', 'This account is not active'));
  }

  req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
  next();
};

// Use after requireAuth: requireRole('ADMIN') or requireRole('TRAINER', 'ADMIN').
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}
