import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

// Why signed links: a <video> or <a> tag cannot send our "Authorization: Bearer" header.
// So a logged-in, authorised user first asks an API endpoint for a link; the link carries
// an expiry time and an HMAC signature, and only works for ~10 minutes.
export const FILE_LINK_TTL_SECONDS = 10 * 60;

// A separate key derived from the JWT secret, so no extra environment variable is needed
// and a file signature can never be mistaken for a login token.
const key = createHash('sha256').update(`file-links:${env.JWT_ACCESS_SECRET}`).digest();

function sign(fileKey: string, name: string, expires: number) {
  return createHmac('sha256', key).update(`${fileKey}\n${name}\n${expires}`).digest('base64url');
}

/** Returns a path like /api/files?k=...&n=...&e=...&s=... (the web app prefixes the API origin). */
export function createFileLink(fileKey: string, downloadName: string, ttlSeconds = FILE_LINK_TTL_SECONDS) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const params = new URLSearchParams({ k: fileKey, n: downloadName, e: String(expires), s: sign(fileKey, downloadName, expires) });
  return { url: `/api/files?${params}`, expiresAt: new Date(expires * 1000).toISOString() };
}

export function verifyFileLink(q: { k?: unknown; n?: unknown; e?: unknown; s?: unknown }) {
  if (typeof q.k !== 'string' || typeof q.n !== 'string' || typeof q.e !== 'string' || typeof q.s !== 'string') return null;
  const expires = Number(q.e);
  if (!Number.isInteger(expires) || expires < Date.now() / 1000) return null;

  const expected = Buffer.from(sign(q.k, q.n, expires));
  const given = Buffer.from(q.s);
  // Constant-time comparison, so response timing reveals nothing about the signature.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { fileKey: q.k, downloadName: q.n };
}
