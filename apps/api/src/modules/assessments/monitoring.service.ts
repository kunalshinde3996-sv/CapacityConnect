import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { type Actor, canManage } from '../courses/courses.service.js';
import type { StoredCompetencyResult } from './assessments.service.js';

type TraineeStatus = 'SUBMITTED' | 'IN_PROGRESS' | 'PENDING' | 'MISSED';

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (score: number | null, max: number | null) => (max ? round1(((score ?? 0) / max) * 100) : 0);

// Everything a trainer needs to follow one course: who is enrolled, who has attempted
// each assessment and who is still pending, their scores, and which competencies the
// class as a whole is weakest in.
export async function courseProgress(actor: Actor, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, trainerId: true, createdById: true } });
  if (!course) throw AppError.notFound('Course not found');
  if (!canManage(actor, course)) throw AppError.forbidden('Only the course trainer or an admin can see class progress');

  const [enrollments, assessments] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, status: { not: 'DROPPED' } },
      include: { user: { select: { id: true, fullName: true, email: true, designation: true, institute: { select: { code: true } } } } },
      orderBy: { user: { fullName: 'asc' } },
    }),
    prisma.assessment.findMany({
      where: { courseId, published: true },
      include: { attempts: true, questions: { select: { competencyId: true, competency: { select: { name: true } } } } },
      orderBy: { deadline: 'asc' },
    }),
  ]);

  const enrolledIds = new Set(enrollments.map((e) => e.userId));
  const now = Date.now();

  // Status of one trainee for one assessment
  function statusOf(assessment: (typeof assessments)[number], userId: string): { status: TraineeStatus; percent: number | null } {
    const attempt = assessment.attempts.find((a) => a.userId === userId);
    if (attempt?.submittedAt) return { status: 'SUBMITTED', percent: pct(attempt.score, attempt.maxScore) };
    if (assessment.deadline.getTime() < now) return { status: 'MISSED', percent: null };
    return { status: attempt ? 'IN_PROGRESS' : 'PENDING', percent: null };
  }

  const assessmentSummaries = assessments.map((a) => {
    const statuses = enrollments.map((e) => statusOf(a, e.userId));
    const scores = statuses.flatMap((s) => (s.percent === null ? [] : [s.percent]));
    return {
      id: a.id,
      title: a.title,
      deadline: a.deadline,
      passPercent: a.passPercent,
      closed: a.deadline.getTime() < now,
      submitted: scores.length,
      inProgress: statuses.filter((s) => s.status === 'IN_PROGRESS').length,
      pending: statuses.filter((s) => s.status === 'PENDING').length,
      missed: statuses.filter((s) => s.status === 'MISSED').length,
      averagePercent: scores.length ? round1(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
      passRate: scores.length ? round1((scores.filter((s) => s >= a.passPercent).length / scores.length) * 100) : null,
    };
  });

  const trainees = enrollments.map((e) => {
    const results = assessments.map((a) => ({ assessmentId: a.id, ...statusOf(a, e.userId) }));
    const scores = results.flatMap((r) => (r.percent === null ? [] : [r.percent]));
    return {
      user: e.user,
      enrolledAt: e.enrolledAt,
      enrollmentStatus: e.status, // ENROLLED or COMPLETED (the trainer can mark completion)
      results,
      averagePercent: scores.length ? round1(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
      outstanding: results.filter((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS').length,
    };
  });

  // Class-wide competency picture: marks obtained / marks available over every submitted
  // attempt by a currently enrolled trainee. Weakest first.
  const names = new Map(assessments.flatMap((a) => a.questions.map((q) => [q.competencyId, q.competency.name] as const)));
  const totals = new Map<string, { obtained: number; max: number; trainees: Set<string> }>();
  for (const a of assessments) {
    for (const attempt of a.attempts) {
      if (!attempt.submittedAt || !enrolledIds.has(attempt.userId)) continue;
      for (const r of (attempt.competencyResults ?? []) as unknown as StoredCompetencyResult[]) {
        const t = totals.get(r.competencyId) ?? { obtained: 0, max: 0, trainees: new Set<string>() };
        t.obtained += r.marksObtained;
        t.max += r.maxMarks;
        t.trainees.add(attempt.userId);
        totals.set(r.competencyId, t);
      }
    }
  }
  const competencies = [...totals]
    .map(([competencyId, t]) => ({
      competencyId,
      name: names.get(competencyId) ?? 'Unknown',
      percent: pct(t.obtained, t.max),
      traineesAssessed: t.trainees.size,
    }))
    .sort((a, b) => a.percent - b.percent);

  const allScores = trainees.flatMap((t) => t.results.flatMap((r) => (r.percent === null ? [] : [r.percent])));
  return {
    course: { id: course.id, title: course.title },
    summary: {
      enrolled: enrollments.length,
      assessments: assessments.length,
      submissions: allScores.length,
      averagePercent: allScores.length ? round1(allScores.reduce((x, y) => x + y, 0) / allScores.length) : null,
      outstanding: trainees.reduce((n, t) => n + t.outstanding, 0),
    },
    assessments: assessmentSummaries,
    trainees,
    competencies, // weakest first
  };
}
