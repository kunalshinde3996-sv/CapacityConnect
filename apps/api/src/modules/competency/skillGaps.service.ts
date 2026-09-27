import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { trustFor } from '../../services/matching/matching.js';
import { teachingClaims } from '../../services/matching/teachingEvidence.js';
import { analyseSkillGaps, type TrainerEvidence } from '../../services/skillGap/skillGap.js';

// Supply vs demand per competency (rules in services/skillGap/skillGap.ts).
// `instituteCode` limits demand (and "trainers at this station") to one institute.
export async function getSkillGaps(instituteCode?: string) {
  const institutes = await prisma.institute.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } });
  const institute = instituteCode ? institutes.find((i) => i.code === instituteCode) : null;
  if (instituteCode && !institute) throw AppError.badRequest('Unknown institute');

  const [competencies, trainees, trainers] = await Promise.all([
    prisma.competency.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        targetLevel: true,
        subjectRequirements: { select: { minLevel: true, subject: { select: { id: true, name: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { role: 'TRAINEE', status: 'APPROVED' },
      select: { id: true, instituteId: true, userCompetencies: { select: { competencyId: true, level: true } } },
    }),
    prisma.user.findMany({
      where: { role: 'TRAINER', status: 'APPROVED' },
      select: {
        id: true,
        instituteId: true,
        trainerCompetencies: { select: { competencyId: true, level: true, evidenceType: true, verified: true } },
        coursesTeaching: { select: { title: true, feedback: { select: { rating: true } }, competencies: { select: { competencyId: true, targetLevel: true } } } },
      },
    }),
  ]);

  // Every trainer's evidence with its trust, including teaching records from feedback.
  const trainerEvidence: TrainerEvidence[] = trainers.flatMap((t) => [
    ...t.trainerCompetencies.map((c) => ({ userId: t.id, instituteId: t.instituteId, competencyId: c.competencyId, level: c.level, trust: trustFor(c) })),
    ...teachingClaims(t.coursesTeaching.map((c) => ({ ...c, ratings: c.feedback.map((f) => f.rating) }))).map((c) => ({
      userId: t.id,
      instituteId: t.instituteId,
      competencyId: c.competencyId,
      level: c.level,
      trust: trustFor(c),
    })),
  ]);

  const rows = analyseSkillGaps({
    competencies: competencies.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      targetLevel: c.targetLevel,
      requiredBySubjects: c.subjectRequirements.map((r) => ({ id: r.subject.id, name: r.subject.name, minLevel: r.minLevel })),
    })),
    trainees: trainees.map((t) => ({ userId: t.id, instituteId: t.instituteId })),
    traineeLevels: trainees.flatMap((t) => t.userCompetencies.map((l) => ({ userId: t.id, instituteId: t.instituteId, ...l }))),
    trainerEvidence,
    instituteId: institute?.id ?? null,
  });

  const inScope = trainees.filter((t) => !institute || t.instituteId === institute.id).length;
  return {
    institutes,
    institute: institute ?? null,
    trainees: inScope,
    rows,
  };
}
