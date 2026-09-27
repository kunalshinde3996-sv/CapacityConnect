import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { rankTrainers, type Requirement } from '../../services/matching/matching.js';
import { teachingClaims } from '../../services/matching/teachingEvidence.js';

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
      // Courses they teach, with ratings: good feedback counts as TEACHING evidence
      coursesTeaching: {
        select: { title: true, feedback: { select: { rating: true } }, competencies: { select: { competencyId: true, targetLevel: true } } },
      },
    },
  });

  let ranked;
  try {
    ranked = rankTrainers(
      requirements,
      trainers.map(({ trainerCompetencies, coursesTeaching, ...trainer }) => ({
        trainer,
        claims: [
          // The trainer's own claims first: on a tie with a derived claim, their own evidence is shown.
          ...trainerCompetencies.map(({ evidenceNote, ...c }) => ({ ...c, note: evidenceNote })),
          ...teachingClaims(coursesTeaching.map((c) => ({ ...c, ratings: c.feedback.map((f) => f.rating) }))),
        ],
      })),
    );
  } catch (err) {
    // e.g. weights that do not sum to 1 - an admin needs to fix the subject first
    throw new AppError(422, 'SUBJECT_MISCONFIGURED', (err as Error).message);
  }

  // Each breakdown row carries the note of the claim that was used (own claim or teaching record).
  return { subject: dto, matches: ranked };
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
