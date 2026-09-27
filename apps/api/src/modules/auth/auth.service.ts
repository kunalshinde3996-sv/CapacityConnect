import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { generateRefreshToken, hashToken, REFRESH_TOKEN_TTL_MS, signAccessToken } from '../../lib/tokens.js';
import { publicUserSelect, type PublicUser } from '../users/users.select.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export interface Session {
  accessToken: string;
  refreshToken: string; // raw value: goes into the HttpOnly cookie, never into the JSON body
  user: PublicUser;
}

// Messages shown to a user whose password was correct but who may not log in yet.
const BLOCKED_STATUS: Record<string, { code: string; message: string }> = {
  PENDING: { code: 'ACCOUNT_PENDING', message: 'Your account is waiting for admin approval' },
  REJECTED: { code: 'ACCOUNT_REJECTED', message: 'Your registration was not approved' },
  DISABLED: { code: 'ACCOUNT_DISABLED', message: 'Your account has been deactivated. Contact an administrator' },
};

export async function register(input: RegisterInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw AppError.conflict('An account with this email already exists');

  if (input.instituteId) {
    const institute = await prisma.institute.findUnique({ where: { id: input.instituteId }, select: { id: true } });
    if (!institute) throw AppError.badRequest('Unknown institute');
  }

  const passwordHash = await hashPassword(input.password);

  // Everyone registers as a PENDING trainee; an admin approves them and can change the role.
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        designation: input.designation,
        phone: input.phone,
        instituteId: input.instituteId,
        traineeProfile: { create: {} },
      },
      select: publicUserSelect,
    });
    await audit(tx, { actorId: user.id, action: 'USER_REGISTERED', entityType: 'User', entityId: user.id });
    return user;
  });
}

export async function login(input: LoginInput): Promise<Session> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true, status: true },
  });

  // Always run bcrypt, even for unknown emails, so response time does not reveal which emails exist.
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  // Only reveal the account status to someone who knows the password.
  const blocked = BLOCKED_STATUS[user.status];
  if (blocked) throw new AppError(403, blocked.code, blocked.message);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return createSession(user.id);
}

// Exchanges a valid refresh token for a new access token AND a new refresh token
// ("rotation"). The old refresh token is revoked, so each one works exactly once.
export async function refresh(rawToken: string | undefined): Promise<Session> {
  if (!rawToken) throw new AppError(401, 'NO_REFRESH_TOKEN', 'Not logged in');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { status: true } } },
  });
  if (!stored) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session is invalid. Please log in again');

  if (stored.revokedAt) {
    // A revoked token being used again means it was probably stolen and used by
    // someone else first. Log out every session of this user to be safe.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session is invalid. Please log in again');
  }

  if (stored.expiresAt < new Date()) {
    throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Session expired. Please log in again');
  }

  if (stored.user.status !== 'APPROVED') {
    await revokeAllSessions(stored.userId);
    throw new AppError(401, 'ACCOUNT_INACTIVE', 'This account is not active');
  }

  // Revoke only if nobody else revoked it in the meantime (two refreshes racing).
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session is invalid. Please log in again');

  return createSession(stored.userId);
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw AppError.notFound('User not found');
  return user;
}

export function revokeAllSessions(userId: string) {
  return prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

async function createSession(userId: string): Promise<Session> {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect });
  return { accessToken: signAccessToken({ sub: user.id, role: user.role }), refreshToken, user };
}
