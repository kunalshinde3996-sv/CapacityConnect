import type { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { createFileLink } from '../storage/fileLinks.js';
import { storage } from '../storage/storage.service.js';
import { storeUpload, type Upload } from '../storage/upload.middleware.js';
import type {
  applicationSchema,
  certificateSchema,
  experienceSchema,
  qualificationSchema,
  skillsSchema,
  updateProfileSchema,
} from './profile.schemas.js';
import { publicUserSelect } from './users.select.js';

// Everything the profile page shows, in one request.
export async function getProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      ...publicUserSelect,
      traineeProfile: { select: { bio: true, interests: true, employeeId: true } },
      trainerProfile: { select: { bio: true, headline: true, yearsOfExperience: true } },
      qualifications: { orderBy: { yearCompleted: 'desc' } },
      experiences: { orderBy: { startDate: 'desc' } },
      certificates: { where: { courseId: null }, orderBy: { createdAt: 'desc' } },
      userCompetencies: {
        include: { competency: { select: { id: true, name: true, category: true } } },
        orderBy: { competency: { name: 'asc' } },
      },
      trainerCompetencies: {
        include: {
          competency: { select: { id: true, name: true, category: true } },
          certificate: { select: { id: true, title: true, status: true } },
          qualification: { select: { id: true, degree: true, fieldOfStudy: true, status: true } },
        },
        orderBy: { competency: { name: 'asc' } },
      },
      trainerApplications: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const { qualifications, certificates, trainerCompetencies, ...rest } = user;
  return {
    ...rest,
    qualifications: qualifications.map(({ fileKey, ...q }) => ({ ...q, hasFile: Boolean(fileKey) })),
    certificates: certificates.map(({ fileKey, ...c }) => ({ ...c, hasFile: Boolean(fileKey) })),
    claims: trainerCompetencies.map(({ evidenceFileKey, ...c }) => ({ ...c, hasEvidenceFile: Boolean(evidenceFileKey) })),
  };
}

export async function updateProfile(userId: string, role: string, input: z.infer<typeof updateProfileSchema>) {
  const { bio, interests, headline, yearsOfExperience, ...userFields } = input;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: userFields });
    if (role === 'TRAINER') {
      await tx.trainerProfile.upsert({
        where: { userId },
        update: { bio, headline, yearsOfExperience },
        create: { userId, bio, headline, yearsOfExperience },
      });
    } else {
      await tx.traineeProfile.upsert({ where: { userId }, update: { bio, interests }, create: { userId, bio, interests } });
    }
  });
  return getProfile(userId);
}

// ── Qualifications ─────────────────────────────────────────

export async function addQualification(userId: string, input: z.infer<typeof qualificationSchema>, upload?: Upload) {
  const file = upload ? await storeUpload(upload, 'qualifications') : null;
  return prisma.qualification.create({ data: { userId, ...input, fileKey: file?.fileKey } });
}

export async function deleteQualification(userId: string, id: string) {
  const q = await prisma.qualification.findFirst({ where: { id, userId } });
  if (!q) throw AppError.notFound('Qualification not found');
  // Verified evidence is part of the audit trail: only an admin conversation can remove it.
  if (q.status === 'VERIFIED') throw AppError.conflict('A verified qualification cannot be deleted');
  await prisma.qualification.delete({ where: { id } });
  if (q.fileKey) await storage.delete(q.fileKey);
}

// ── Experience ─────────────────────────────────────────────

export function addExperience(userId: string, input: z.infer<typeof experienceSchema>) {
  return prisma.experience.create({ data: { userId, ...input } });
}

export async function deleteExperience(userId: string, id: string) {
  const { count } = await prisma.experience.deleteMany({ where: { id, userId } });
  if (count === 0) throw AppError.notFound('Experience not found');
}

// ── Certificates ───────────────────────────────────────────

export async function addCertificate(userId: string, input: z.infer<typeof certificateSchema>, upload: Upload) {
  const file = await storeUpload(upload, 'certificates');
  // Every uploaded certificate starts as PENDING until an admin verifies it.
  return prisma.certificate.create({ data: { userId, ...input, fileKey: file.fileKey, status: 'PENDING' } });
}

export async function deleteCertificate(userId: string, id: string) {
  const cert = await prisma.certificate.findFirst({ where: { id, userId, courseId: null } });
  if (!cert) throw AppError.notFound('Certificate not found');
  if (cert.status === 'VERIFIED') throw AppError.conflict('A verified certificate cannot be deleted');
  await prisma.certificate.delete({ where: { id } });
  if (cert.fileKey) await storage.delete(cert.fileKey);
}

// Owner or admin only. Returns a short-lived signed link (see storage/fileLinks.ts).
export async function certificateFileLink(requester: { id: string; role: string }, id: string) {
  const cert = await prisma.certificate.findUnique({ where: { id } });
  if (!cert?.fileKey || (cert.userId !== requester.id && requester.role !== 'ADMIN')) {
    throw AppError.notFound('Certificate file not found');
  }
  return createFileLink(cert.fileKey, `${cert.title}${cert.fileKey.slice(cert.fileKey.lastIndexOf('.'))}`);
}

export async function qualificationFileLink(requester: { id: string; role: string }, id: string) {
  const q = await prisma.qualification.findUnique({ where: { id } });
  if (!q?.fileKey || (q.userId !== requester.id && requester.role !== 'ADMIN')) {
    throw AppError.notFound('Qualification file not found');
  }
  return createFileLink(q.fileKey, `${q.degree} ${q.fieldOfStudy}${q.fileKey.slice(q.fileKey.lastIndexOf('.'))}`);
}

// ── Skills (self-assessed levels, picked from the framework) ─

// Replaces the user's SELF_ASSESSED skills with the given list. Levels measured by an
// assessment (or set by an admin) are evidence, so self-assessment never overwrites them.
export async function setSkills(userId: string, input: z.infer<typeof skillsSchema>) {
  const ids = input.skills.map((s) => s.competencyId);
  const [known, locked] = await Promise.all([
    prisma.competency.count({ where: { id: { in: ids }, isActive: true } }),
    prisma.userCompetency.findMany({ where: { userId, source: { not: 'SELF_ASSESSED' } }, select: { competencyId: true } }),
  ]);
  if (known !== ids.length) throw AppError.badRequest('One or more competencies do not exist');
  const lockedIds = new Set(locked.map((l) => l.competencyId));

  await prisma.$transaction([
    prisma.userCompetency.deleteMany({ where: { userId, source: 'SELF_ASSESSED', competencyId: { notIn: ids } } }),
    ...input.skills
      .filter((s) => !lockedIds.has(s.competencyId))
      .map((s) =>
        prisma.userCompetency.upsert({
          where: { userId_competencyId: { userId, competencyId: s.competencyId } },
          update: { level: s.level, source: 'SELF_ASSESSED' },
          create: { userId, competencyId: s.competencyId, level: s.level, source: 'SELF_ASSESSED' },
        }),
      ),
  ]);
  return getProfile(userId);
}

// ── Applying to become a trainer ───────────────────────────

export async function applyForTrainer(userId: string, role: string, input: z.infer<typeof applicationSchema>) {
  if (role !== 'TRAINEE') throw AppError.badRequest('Only trainees can apply to become a trainer');
  const pending = await prisma.trainerApplication.findFirst({ where: { userId, status: 'PENDING' } });
  if (pending) throw AppError.conflict('You already have an application waiting for review');

  return prisma.$transaction(async (tx) => {
    const application = await tx.trainerApplication.create({ data: { userId, motivation: input.motivation } });
    await audit(tx, { actorId: userId, action: 'TRAINER_APPLICATION_SUBMITTED', entityType: 'TrainerApplication', entityId: application.id });
    return application;
  });
}
