import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// Cost 10 (the default) = 2^10 hashing rounds: slow enough to resist brute force,
// fast enough for login. Tests lower it via BCRYPT_COST.
const COST = env.BCRYPT_COST;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Compared against when the email does not exist, so a login for an unknown
// email takes as long as one for a real account (no timing leak).
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);
