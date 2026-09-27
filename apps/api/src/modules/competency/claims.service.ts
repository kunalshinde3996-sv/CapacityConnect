import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { createFileLink } from '../storage/fileLinks.js';
import { storage } from '../storage/storage.service.js';
import { storeUpload, type Upload } from '../storage/upload.middleware.js';
import type { ClaimInput } from './claims.schemas.js';

export function listCompetencies() {
  return prisma.competency.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: true, description: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

// Creates or updates the trainer's claim for one competency.
//
// Verification rule: a claim is only "verified" (trust 1.0) after an admin reviewed THIS
// claim against its certificate/qualification. Any edit resets the review, so a trainer
// cannot raise a level after it was checked.
export async function saveClaim(userId: string, input: ClaimInput, upload?: Upload) {
  const competency = await prisma.competency.findFirst({ where: { id: input.competencyId, isActive: true } });
  if (!competency) throw AppError.badRequest('Unknown competency');

  const usesCertificate = input.evidenceType === 'CERTIFICATE';
  const usesQualification = input.evidenceType === 'QUALIFICATION';

  if (usesCertificate) {
    const cert = await prisma.certificate.findFirst({ where: { id: input.certificateId, userId } });
    if (!cert) throw AppError.badRequest('Certificate not found in your profile');
    if (cert.status === 'REJECTED') throw AppError.badRequest('That certificate was rejected by an admin');
  }
  if (usesQualification) {
    const q = await prisma.qualification.findFirst({ where: { id: input.qualificationId, userId } });
    if (!q) throw AppError.badRequest('Qualification not found in your profile');
    if (q.status === 'REJECTED') throw AppError.badRequest('That qualification was rejected by an admin');
  }

  const existing = await prisma.trainerCompetency.findUnique({
    where: { userId_competencyId: { userId, competencyId: input.competencyId } },
  });
  const file = upload ? await storeUpload(upload, 'evidence') : null;

  const data = {
    level: input.level,
    evidenceType: input.evidenceType,
    evidenceNote: input.evidenceNote ?? null,
    certificateId: usesCertificate ? input.certificateId! : null,
    qualificationId: usesQualification ? input.qualificationId! : null,
    ...(file && { evidenceFileKey: file.fileKey }),
    // Reset the review: see the rule above.
    verified: false,
    verifiedAt: null,
    verifiedById: null,
  };

  const claim = await prisma.$transaction(async (tx) => {
    const saved = await tx.trainerCompetency.upsert({
      where: { userId_competencyId: { userId, competencyId: input.competencyId } },
      update: data,
      create: { userId, competencyId: input.competencyId, ...data },
    });
    await audit(tx, {
      actorId: userId,
      action: existing ? 'CLAIM_UPDATED' : 'CLAIM_CREATED',
      entityType: 'TrainerCompetency',
      entityId: saved.id,
      metadata: { competency: competency.name, level: input.level, evidenceType: input.evidenceType },
    });
    return saved;
  });

  // Replaced evidence file: remove the old one after the database change succeeded.
  if (file && existing?.evidenceFileKey) await storage.delete(existing.evidenceFileKey);
  return claim;
}

export async function deleteClaim(userId: string, competencyId: string) {
  const claim = await prisma.trainerCompetency.findUnique({ where: { userId_competencyId: { userId, competencyId } } });
  if (!claim) throw AppError.notFound('Claim not found');
  await prisma.$transaction(async (tx) => {
    await tx.trainerCompetency.delete({ where: { id: claim.id } });
    await audit(tx, { actorId: userId, action: 'CLAIM_DELETED', entityType: 'TrainerCompetency', entityId: claim.id });
  });
  if (claim.evidenceFileKey) await storage.delete(claim.evidenceFileKey);
}

export async function claimEvidenceLink(requester: { id: string; role: string }, claimId: string) {
  const claim = await prisma.trainerCompetency.findUnique({ where: { id: claimId }, include: { competency: true } });
  if (!claim?.evidenceFileKey || (claim.userId !== requester.id && requester.role !== 'ADMIN')) {
    throw AppError.notFound('Evidence file not found');
  }
  const ext = claim.evidenceFileKey.slice(claim.evidenceFileKey.lastIndexOf('.'));
  return createFileLink(claim.evidenceFileKey, `Evidence - ${claim.competency.name}${ext}`);
}
