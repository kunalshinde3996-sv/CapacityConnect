import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '../generated/prisma/client.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
}

// Short-lived, stateless token sent as "Authorization: Bearer <token>".
export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  // Pin the algorithm so a token signed with anything else is rejected.
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') throw new Error('Malformed token');
  return { sub: decoded.sub, role: decoded.role as Role };
}

// The refresh token is a random opaque string (not a JWT): it is always looked up
// in the database anyway, so a signature would add nothing. Only its hash is stored,
// so a leaked database dump cannot be used to log in.
export function generateRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
