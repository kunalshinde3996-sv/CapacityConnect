import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { rankTrainers, type Requirement } from '../../services/matching/matching.js';

const requirementInclude = {
  requirements: {
    include: { competency: { select: { id: true, name: true, category: true } } },
    orderBy: { weight: 'desc' },
  },
} satisfies Prisma.SubjectInclude;

export async function listSubjects() {
  const subjects = await prisma.subject.findMany({ include: requirementInclude, orderBy: { name: 'asc' } });
  return subjects.map(toSubjectDto);
}

// Ranks every APPROVED trainer for the subject and returns the full per-competency
// breakdown, so the UI can answer "why this trainer?" for every score.
export async function getTrainerMatches(subjectId: string) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, include: requirementInclude });
  if (!subject) throw AppError.notFound('Subject not found');

  const dto = toSubjectDto(subject);
  const requirements: Requirement[] = dto.requirements.map((r) => ({
    competencyId: r.competency.id,
    competencyName: r.competency.name,
    minLevel: r.minLevel,
    weight: r.weight,
  }));

  const trainers = await prisma.user.findMany({
    where: { role: 'TRAINER', status: 'APPROVED' },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      designation: true,
      institute: { select: { code: true, name: true } },
      trainerProfile: { select: { headline: true, yearsOfExperience: true } },
      // Only the claims that matter for this subject
      trainerCompetencies: {
        where: { competencyId: { in: requirements.map((r) => r.competencyId) } },
        select: { competencyId: true, level: true, evidenceType: true, verified: true, evidenceNote: true },
      },
    },
  });

  let ranked;
  try {
    ranked = rankTrainers(
      requirements,
      trainers.map(({ trainerCompetencies, ...trainer }) => ({ trainer, claims: trainerCompetencies })),
    );
  } catch (err) {
    // e.g. weights that do not sum to 1 - an admin needs to fix the subject first
    throw new AppError(422, 'SUBJECT_MISCONFIGURED', (err as Error).message);
  }

  // Attach the trainer's evidence note to each row, so the UI can show *what* the evidence is.
  const notes = new Map(trainers.flatMap((t) => t.trainerCompetencies.map((c) => [`${t.id}:${c.competencyId}`, c.evidenceNote])));
  const matches = ranked.map((m) => ({
    ...m,
    breakdown: m.breakdown.map((row) => ({ ...row, evidenceNote: notes.get(`${m.trainer.id}:${row.competencyId}`) ?? null })),
  }));

  return { subject: dto, matches };
}

type SubjectWithRequirements = Prisma.SubjectGetPayload<{ include: typeof requirementInclude }>;

// Prisma returns Decimal objects for weights; the API sends plain numbers.
function toSubjectDto(subject: SubjectWithRequirements) {
  return {
    id: subject.id,
    name: subject.name,
    description: subject.description,
    requirements: subject.requirements.map((r) => ({
      competency: r.competency,
      minLevel: r.minLevel,
      weight: r.weight.toNumber(),
    })),
  };
}
