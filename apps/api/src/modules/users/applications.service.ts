import type { ApprovalStatus } from '../../generated/prisma/client.js';
import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { publicUserSelect } from './users.select.js';

export function listApplications(status: ApprovalStatus | undefined) {
  return prisma.trainerApplication.findMany({
    where: { status },
    include: {
      user: {
        select: {
          ...publicUserSelect,
          qualifications: { select: { degree: true, fieldOfStudy: true, institution: true, status: true } },
          experiences: { select: { organisation: true, title: true, startDate: true, endDate: true }, orderBy: { startDate: 'desc' } },
          userCompetencies: { select: { level: true, source: true, competency: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

// Approving makes the applicant a TRAINER (with a trainer profile) in the same transaction.
export async function reviewApplication(adminId: string, id: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
  const application = await prisma.trainerApplication.findUnique({ where: { id }, include: { user: true } });
  if (!application) throw AppError.notFound('Application not found');
  const approve = decision === 'APPROVE';

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.trainerApplication.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: approve ? 'APPROVED' : 'REJECTED', reviewedById: adminId, reviewedAt: new Date(), reviewNote: reason },
    });
    if (count === 0) throw AppError.conflict('This application has already been reviewed');

    if (approve) {
      await tx.user.update({
        where: { id: application.userId },
        data: { role: 'TRAINER', trainerProfile: { connectOrCreate: { where: { userId: application.userId }, create: {} } } },
      });
    }
    await audit(tx, {
      actorId: adminId,
      action: approve ? 'TRAINER_APPLICATION_APPROVED' : 'TRAINER_APPLICATION_REJECTED',
      entityType: 'TrainerApplication',
      entityId: id,
      metadata: {
        userId: application.userId,
        ...(approve && { roleFrom: application.user.role, roleTo: 'TRAINER' }),
        ...(reason && { reason }),
      },
    });
    return tx.trainerApplication.findUniqueOrThrow({ where: { id } });
  });
}
