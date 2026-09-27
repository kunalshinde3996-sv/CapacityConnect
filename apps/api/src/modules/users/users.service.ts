import type { Role, UserStatus } from '../../generated/prisma/client.js';
import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { publicUserSelect, type PublicUser } from './users.select.js';
import type { ListUsersQuery } from './users.schemas.js';

// Note: there is deliberately no "delete user". Admins disable accounts instead,
// so assessment attempts, certificates and audit history are always preserved.

export async function listUsers(query: ListUsersQuery) {
  const where = { status: query.status, role: query.role };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      // Oldest pending request first, so nobody waits forever
      orderBy: { createdAt: query.status === 'PENDING' ? 'asc' : 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export function approveUser(adminId: string, userId: string) {
  return changeStatus(adminId, userId, { from: ['PENDING'], to: 'APPROVED', action: 'USER_APPROVED' });
}

export function rejectUser(adminId: string, userId: string, reason?: string) {
  return changeStatus(adminId, userId, { from: ['PENDING'], to: 'REJECTED', action: 'USER_REJECTED', reason });
}

export function disableUser(adminId: string, userId: string, reason?: string) {
  if (adminId === userId) throw AppError.badRequest('You cannot disable your own account');
  return changeStatus(adminId, userId, { from: ['APPROVED'], to: 'DISABLED', action: 'USER_DISABLED', reason });
}

export function enableUser(adminId: string, userId: string) {
  return changeStatus(adminId, userId, { from: ['DISABLED'], to: 'APPROVED', action: 'USER_ENABLED' });
}

export async function changeRole(adminId: string, userId: string, role: Role): Promise<PublicUser> {
  // Prevents the last admin from accidentally locking everyone out of admin pages.
  if (adminId === userId) throw AppError.badRequest('You cannot change your own role');

  const user = await findUserOrThrow(userId);
  if (user.role === role) return user;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        role,
        // Make sure the matching profile exists (they are kept if the role changes back).
        ...(role === 'TRAINER' && { trainerProfile: { connectOrCreate: { where: { userId }, create: {} } } }),
        ...(role === 'TRAINEE' && { traineeProfile: { connectOrCreate: { where: { userId }, create: {} } } }),
      },
      select: publicUserSelect,
    });
    await audit(tx, {
      actorId: adminId,
      action: 'ROLE_CHANGED',
      entityType: 'User',
      entityId: userId,
      metadata: { from: user.role, to: role },
    });
    return updated;
  });
}

async function changeStatus(
  adminId: string,
  userId: string,
  change: { from: UserStatus[]; to: UserStatus; action: string; reason?: string },
): Promise<PublicUser> {
  const user = await findUserOrThrow(userId);
  if (!change.from.includes(user.status)) {
    throw AppError.conflict(`Cannot change a ${user.status} account to ${change.to}`);
  }

  return prisma.$transaction(async (tx) => {
    // Re-check the status inside the update, so two admins acting at the same
    // moment cannot both succeed (e.g. one approves while the other rejects).
    const { count } = await tx.user.updateMany({
      where: { id: userId, status: { in: change.from } },
      data: { status: change.to },
    });
    if (count === 0) throw AppError.conflict('This account was changed by someone else. Refresh and try again');
    const updated = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect });

    // A disabled user is logged out everywhere straight away.
    if (change.to === 'DISABLED') {
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    await audit(tx, {
      actorId: adminId,
      action: change.action,
      entityType: 'User',
      entityId: userId,
      metadata: { from: user.status, to: change.to, ...(change.reason && { reason: change.reason }) },
    });
    return updated;
  });
}

async function findUserOrThrow(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw AppError.notFound('User not found');
  return user;
}
