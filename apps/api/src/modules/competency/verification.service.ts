import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { notify } from '../notifications/notifications.service.js';
import type { ReviewInput } from './claims.schemas.js';

const owner = { select: { id: true, fullName: true, email: true, role: true, institute: { select: { code: true } } } };
const DOCUMENT_EVIDENCE = ['CERTIFICATE', 'QUALIFICATION'] as const;

// The admin's verification queue has two lists:
//  1. claims: trainer claims backed by a certificate/qualification that nobody has reviewed yet
//     (only these can reach trust 1.0, so only these need an admin);
//  2. documents: other pending certificates/qualifications (e.g. a trainee's uploads).
//     Documents behind an unreviewed claim are reviewed together with that claim instead.
export async function getQueue() {
  const [claims, certificates, qualifications] = await Promise.all([
    prisma.trainerCompetency.findMany({
      where: { evidenceType: { in: [...DOCUMENT_EVIDENCE] }, verifiedAt: null },
      include: {
        user: owner,
        competency: { select: { id: true, name: true, category: true } },
        certificate: { select: { id: true, title: true, issuer: true, issuedOn: true, status: true, fileKey: true } },
        qualification: {
          select: { id: true, degree: true, fieldOfStudy: true, institution: true, yearCompleted: true, status: true, fileKey: true },
        },
      },
      orderBy: { updatedAt: 'asc' }, // oldest first
    }),
    prisma.certificate.findMany({
      where: { status: 'PENDING', courseId: null, claims: { none: { verifiedAt: null } } },
      include: { user: owner },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.qualification.findMany({
      where: { status: 'PENDING', claims: { none: { verifiedAt: null } } },
      include: { user: owner },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const strip = <T extends { fileKey: string | null }>({ fileKey, ...rest }: T) => ({ ...rest, hasFile: Boolean(fileKey) });
  return {
    claims: claims.map(({ evidenceFileKey, certificate, qualification, ...c }) => ({
      ...c,
      hasEvidenceFile: Boolean(evidenceFileKey),
      certificate: certificate && strip(certificate),
      qualification: qualification && strip(qualification),
    })),
    documents: [
      ...certificates.map((c) => ({ kind: 'CERTIFICATE' as const, ...strip(c) })),
      ...qualifications.map((q) => ({ kind: 'QUALIFICATION' as const, ...strip(q) })),
    ],
  };
}

// Approve: the claim becomes verified (trust 1.0 in matching) and its document is marked VERIFIED.
// Reject: the claim stays unverified (trust 0.5) and leaves the queue; the reason is audited.
export async function reviewClaim(adminId: string, claimId: string, input: ReviewInput) {
  const claim = await prisma.trainerCompetency.findUnique({ where: { id: claimId }, include: { competency: true } });
  if (!claim || !(DOCUMENT_EVIDENCE as readonly string[]).includes(claim.evidenceType)) throw AppError.notFound('Claim not found');

  const approve = input.decision === 'APPROVE';
  const now = new Date();

  const reviewed = await reviewClaimInTransaction(adminId, claim, approve, now, input);
  await notify([claim.userId], {
    type: 'VERIFICATION_RESULT',
    title: approve ? `Claim verified: ${claim.competency.name}` : `Claim not accepted: ${claim.competency.name}`,
    body: approve
      ? `An admin verified your ${claim.competency.name} claim (level ${claim.level}). It now counts fully in trainer matching.`
      : `An admin did not accept the evidence for your ${claim.competency.name} claim${input.reason ? `: ${input.reason}` : '.'} It still counts as unverified.`,
    link: '/profile',
  });
  return reviewed;
}

function reviewClaimInTransaction(
  adminId: string,
  claim: { id: string; userId: string; level: number; evidenceType: string; certificateId: string | null; qualificationId: string | null; competency: { name: string } },
  approve: boolean,
  now: Date,
  input: ReviewInput,
) {
  const claimId = claim.id;
  return prisma.$transaction(async (tx) => {
    // Only if still unreviewed (another admin may have acted a moment ago).
    const { count } = await tx.trainerCompetency.updateMany({
      where: { id: claimId, verifiedAt: null },
      data: { verified: approve, verifiedAt: now, verifiedById: adminId },
    });
    if (count === 0) throw AppError.conflict('This claim has already been reviewed');

    if (approve && claim.certificateId) {
      await tx.certificate.updateMany({
        where: { id: claim.certificateId, status: 'PENDING' },
        data: { status: 'VERIFIED', verifiedAt: now, verifiedById: adminId },
      });
    }
    if (approve && claim.qualificationId) {
      await tx.qualification.updateMany({
        where: { id: claim.qualificationId, status: 'PENDING' },
        data: { status: 'VERIFIED', verifiedAt: now, verifiedById: adminId },
      });
    }

    await audit(tx, {
      actorId: adminId,
      action: approve ? 'CLAIM_VERIFIED' : 'CLAIM_REJECTED',
      entityType: 'TrainerCompetency',
      entityId: claimId,
      metadata: {
        trainerId: claim.userId,
        competency: claim.competency.name,
        level: claim.level,
        evidenceType: claim.evidenceType,
        ...(input.reason && { reason: input.reason }),
      },
    });
    return tx.trainerCompetency.findUniqueOrThrow({ where: { id: claimId } });
  });
}

export async function reviewDocument(adminId: string, kind: 'certificate' | 'qualification', id: string, input: ReviewInput) {
  const approve = input.decision === 'APPROVE';
  const data = approve
    ? { status: 'VERIFIED' as const, verifiedAt: new Date(), verifiedById: adminId, rejectionReason: null }
    : { status: 'REJECTED' as const, verifiedAt: new Date(), verifiedById: adminId, rejectionReason: input.reason ?? null };

  const result = await prisma.$transaction(async (tx) => {
    const { count } =
      kind === 'certificate'
        ? await tx.certificate.updateMany({ where: { id, status: 'PENDING' }, data })
        : await tx.qualification.updateMany({ where: { id, status: 'PENDING' }, data });
    if (count === 0) {
      const exists =
        kind === 'certificate' ? await tx.certificate.count({ where: { id } }) : await tx.qualification.count({ where: { id } });
      throw exists ? AppError.conflict('This document has already been reviewed') : AppError.notFound('Document not found');
    }

    await audit(tx, {
      actorId: adminId,
      action: `${kind.toUpperCase()}_${approve ? 'VERIFIED' : 'REJECTED'}`,
      entityType: kind === 'certificate' ? 'Certificate' : 'Qualification',
      entityId: id,
      metadata: input.reason ? { reason: input.reason } : undefined,
    });
    return { id, status: data.status };
  });

  // Tell the owner of the document
  const doc =
    kind === 'certificate'
      ? await prisma.certificate.findUniqueOrThrow({ where: { id }, select: { userId: true, title: true } })
      : await prisma.qualification.findUniqueOrThrow({ where: { id }, select: { userId: true, degree: true, fieldOfStudy: true } });
  const name = 'title' in doc ? doc.title : `${doc.degree} ${doc.fieldOfStudy}`;
  await notify([doc.userId], {
    type: 'VERIFICATION_RESULT',
    title: approve ? `Verified: ${name}` : `Not verified: ${name}`,
    body: approve
      ? `An admin verified your ${kind} "${name}".`
      : `An admin could not verify your ${kind} "${name}"${input.reason ? `: ${input.reason}` : '.'} You can upload a clearer copy.`,
    link: '/profile',
  });
  return result;
}
