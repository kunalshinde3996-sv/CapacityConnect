import type { Prisma } from '../../generated/prisma/client.js';
import { audit } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  type AnswerRecord,
  type CompetencyResult,
  type CompetencySource,
  type LevelChange,
  levelUpdates,
  scoreAttempt,
  strengthOf,
} from '../../services/assessment/scoring.js';
import { type Actor, canManage } from '../courses/courses.service.js';
import { notify } from '../notifications/notifications.service.js';
import type { AssessmentInput } from './assessments.schemas.js';

// Small allowance for network delay: a submission sent at the last second still counts.
const GRACE_MS = 30 * 1000;
const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

interface StoredOption {
  id: string;
  text: string;
}

// What we store in AssessmentAttempt.competencyResults: the score per competency
// plus what happened to the trainee's level (see services/assessment/scoring.ts).
export type StoredCompetencyResult = CompetencyResult & {
  strength: 'STRONG' | 'DEVELOPING' | 'WEAK';
  level: Pick<LevelChange, 'before' | 'after' | 'measured' | 'write' | 'levelChanged' | 'reason'> | null;
};

// ── Helpers ────────────────────────────────────────────────

async function findCourseForStaff(actor: Actor, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { competencies: true } });
  if (!course) throw AppError.notFound('Course not found');
  if (!canManage(actor, course)) throw AppError.forbidden('Only the course trainer or an admin can manage its assessments');
  return course;
}

async function findAssessmentForStaff(actor: Actor, id: string) {
  const assessment = await prisma.assessment.findUnique({ where: { id }, include: { course: { include: { competencies: true } } } });
  if (!assessment) throw AppError.notFound('Assessment not found');
  if (!canManage(actor, assessment.course)) throw AppError.forbidden('Only the course trainer or an admin can manage this assessment');
  return assessment;
}

// Questions must test competencies the course actually builds, so results map onto it.
function toQuestionRows(input: AssessmentInput, courseCompetencyIds: Set<string>) {
  return input.questions.map((q, i) => {
    if (!courseCompetencyIds.has(q.competencyId)) {
      throw AppError.badRequest(`Question ${i + 1} is tagged with a competency this course does not build`);
    }
    const options: StoredOption[] = q.options.map((text, j) => ({ id: OPTION_IDS[j]!, text }));
    return {
      order: i + 1,
      text: q.text,
      competencyId: q.competencyId,
      options: options as unknown as Prisma.InputJsonValue,
      correctOptionId: OPTION_IDS[q.correctIndex]!,
      marks: q.marks,
      explanation: q.explanation ?? null,
    };
  });
}

function assertFutureDeadline(deadline: Date) {
  if (deadline.getTime() <= Date.now()) throw AppError.badRequest('The deadline must be in the future');
}

const endsAtFor = (a: { deadline: Date; durationMinutes: number | null }, startedAt: Date) =>
  a.durationMinutes ? new Date(Math.min(a.deadline.getTime(), startedAt.getTime() + a.durationMinutes * 60_000)) : a.deadline;

const questionInclude = { competency: { select: { id: true, name: true } } } as const;

// The trainee's view of a question: NEVER includes the correct option or the explanation.
function safeQuestion(q: Prisma.QuestionGetPayload<{ include: typeof questionInclude }>) {
  return { id: q.id, order: q.order, text: q.text, marks: q.marks, competency: q.competency, options: q.options as unknown as StoredOption[] };
}

// ── Trainer side ───────────────────────────────────────────

export async function createAssessment(actor: Actor, courseId: string, input: AssessmentInput) {
  const course = await findCourseForStaff(actor, courseId);
  assertFutureDeadline(input.deadline);
  const questions = toQuestionRows(input, new Set(course.competencies.map((c) => c.competencyId)));

  return prisma.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: {
        courseId,
        title: input.title,
        description: input.description,
        deadline: input.deadline,
        durationMinutes: input.durationMinutes ?? null,
        passPercent: input.passPercent,
        createdById: actor.id,
        questions: { create: questions },
      },
    });
    await audit(tx, { actorId: actor.id, action: 'ASSESSMENT_CREATED', entityType: 'Assessment', entityId: assessment.id });
    return assessment;
  });
}

// Replaces the whole questionnaire. Locked once anyone has started it, so every
// trainee answers exactly the same questions.
export async function updateAssessment(actor: Actor, id: string, input: AssessmentInput) {
  const assessment = await findAssessmentForStaff(actor, id);
  if (await prisma.assessmentAttempt.count({ where: { assessmentId: id } })) {
    throw AppError.conflict('Trainees have already started this assessment, so it can no longer be edited');
  }
  assertFutureDeadline(input.deadline);
  const questions = toQuestionRows(input, new Set(assessment.course.competencies.map((c) => c.competencyId)));

  return prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { assessmentId: id } });
    return tx.assessment.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        deadline: input.deadline,
        durationMinutes: input.durationMinutes ?? null,
        passPercent: input.passPercent,
        questions: { create: questions },
      },
    });
  });
}

export async function setPublished(actor: Actor, id: string, published: boolean) {
  const assessment = await findAssessmentForStaff(actor, id);
  if (published) assertFutureDeadline(assessment.deadline);
  if (!published && (await prisma.assessmentAttempt.count({ where: { assessmentId: id } }))) {
    throw AppError.conflict('Trainees have already started this assessment; it cannot be unpublished');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.assessment.update({ where: { id }, data: { published } });
    await audit(tx, { actorId: actor.id, action: published ? 'ASSESSMENT_PUBLISHED' : 'ASSESSMENT_UNPUBLISHED', entityType: 'Assessment', entityId: id });
    return saved;
  });

  if (published) {
    // Tell every enrolled trainee (once per assessment, even if it is re-published).
    const enrolled = await prisma.enrollment.findMany({ where: { courseId: assessment.courseId, status: 'ENROLLED' }, select: { userId: true } });
    const when = assessment.deadline.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
    await notify(
      enrolled.map((e) => e.userId),
      {
        type: 'NEW_ASSESSMENT',
        title: `New assessment: ${assessment.title}`,
        body: `"${assessment.title}" is now open in "${assessment.course.title}". Deadline: ${when} IST.`,
        link: `/assessments/${id}`,
        dedupeKey: `assessment:${id}`,
      },
    );
  }
  return updated;
}

// ── Listing and viewing ────────────────────────────────────

export async function listForCourse(actor: Actor, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw AppError.notFound('Course not found');

  if (canManage(actor, course)) {
    return prisma.assessment.findMany({
      where: { courseId },
      include: { _count: { select: { questions: true, attempts: { where: { submittedAt: { not: null } } } } } },
      orderBy: { deadline: 'asc' },
    });
  }

  await assertEnrolled(actor.id, courseId);
  const assessments = await prisma.assessment.findMany({
    where: { courseId, published: true },
    include: {
      _count: { select: { questions: true } },
      attempts: { where: { userId: actor.id }, select: { startedAt: true, submittedAt: true, score: true, maxScore: true } },
    },
    orderBy: { deadline: 'asc' },
  });
  return assessments.map(({ attempts, ...a }) => ({ ...a, myAttempt: attempts[0] ?? null }));
}

export async function getAssessment(actor: Actor, id: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, title: true, trainerId: true, createdById: true } },
      questions: { include: questionInclude, orderBy: { order: 'asc' } },
      attempts: { where: { userId: actor.id }, select: { startedAt: true, submittedAt: true, score: true, maxScore: true } },
      _count: { select: { attempts: true } },
    },
  });
  if (!assessment) throw AppError.notFound('Assessment not found');
  const { attempts, questions, ...rest } = assessment;

  // Trainer / admin: full questionnaire including answers, for editing.
  if (canManage(actor, assessment.course)) {
    return {
      ...rest,
      canManage: true,
      locked: assessment._count.attempts > 0,
      questions: questions.map((q) => {
        const options = q.options as unknown as StoredOption[];
        return { ...safeQuestion(q), correctIndex: options.findIndex((o) => o.id === q.correctOptionId), explanation: q.explanation };
      }),
    };
  }

  // Trainee: only published, only if enrolled, and never the answers.
  if (!assessment.published) throw AppError.notFound('Assessment not found');
  await assertEnrolled(actor.id, assessment.courseId);
  const myAttempt = attempts[0] ?? null;
  return {
    ...rest,
    canManage: false,
    myAttempt: myAttempt && { ...myAttempt, endsAt: endsAtFor(assessment, myAttempt.startedAt) },
    competencies: [...new Map(questions.map((q) => [q.competency.id, q.competency])).values()],
    questionCount: questions.length,
    // Questions are only sent once the attempt has started (see start()).
    questions: myAttempt && !myAttempt.submittedAt ? questions.map(safeQuestion) : [],
  };
}

async function assertEnrolled(userId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (!enrollment || enrollment.status === 'DROPPED') throw AppError.forbidden('Enrol in the course to take its assessments');
}

// ── Trainee side: start, submit, result ────────────────────

export async function start(userId: string, id: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { questions: { include: questionInclude, orderBy: { order: 'asc' } } },
  });
  if (!assessment || !assessment.published) throw AppError.notFound('Assessment not found');
  await assertEnrolled(userId, assessment.courseId);

  const existing = await prisma.assessmentAttempt.findUnique({ where: { assessmentId_userId: { assessmentId: id, userId } } });
  if (existing?.submittedAt) throw AppError.conflict('You have already submitted this assessment');
  if (!existing && Date.now() > assessment.deadline.getTime()) {
    throw new AppError(409, 'DEADLINE_PASSED', 'The deadline for this assessment has passed');
  }

  // One attempt per trainee: starting again just resumes the same attempt.
  const attempt = existing ?? (await prisma.assessmentAttempt.create({ data: { assessmentId: id, userId } }));
  return {
    startedAt: attempt.startedAt,
    endsAt: endsAtFor(assessment, attempt.startedAt),
    questions: assessment.questions.map(safeQuestion),
  };
}

export async function submit(userId: string, id: string, answers: Record<string, string | null>) {
  const assessment = await prisma.assessment.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'asc' } } } });
  if (!assessment || !assessment.published) throw AppError.notFound('Assessment not found');

  const attempt = await prisma.assessmentAttempt.findUnique({ where: { assessmentId_userId: { assessmentId: id, userId } } });
  if (!attempt) throw AppError.badRequest('Start the assessment before submitting');
  if (attempt.submittedAt) throw AppError.conflict('You have already submitted this assessment');
  if (Date.now() > endsAtFor(assessment, attempt.startedAt).getTime() + GRACE_MS) {
    throw new AppError(409, 'DEADLINE_PASSED', 'Time is up: the deadline or time limit for this assessment has passed');
  }

  // Scored on the server, from the stored answers. The client never saw them.
  const scored = scoreAttempt(assessment.questions, answers);
  const current = await prisma.userCompetency.findMany({
    where: { userId, competencyId: { in: scored.competencyResults.map((r) => r.competencyId) } },
  });
  const changes = levelUpdates(scored.competencyResults, new Map(current.map((c) => [c.competencyId, { level: c.level, source: c.source as CompetencySource }])));
  const byCompetency = new Map(changes.map((c) => [c.competencyId, c]));
  const stored: StoredCompetencyResult[] = scored.competencyResults.map((r) => {
    const change = byCompetency.get(r.competencyId);
    return {
      ...r,
      strength: strengthOf(r.percent),
      level: change ? { before: change.before, after: change.after, measured: change.measured, write: change.write, levelChanged: change.levelChanged, reason: change.reason } : null,
    };
  });

  await prisma.$transaction(async (tx) => {
    // Only if still unsubmitted: a double-click cannot submit twice.
    const { count } = await tx.assessmentAttempt.updateMany({
      where: { id: attempt.id, submittedAt: null },
      data: {
        submittedAt: new Date(),
        score: scored.score,
        maxScore: scored.maxScore,
        answers: scored.answers as unknown as Prisma.InputJsonValue,
        competencyResults: stored as unknown as Prisma.InputJsonValue,
      },
    });
    if (count === 0) throw AppError.conflict('You have already submitted this assessment');

    for (const change of changes.filter((c) => c.write)) {
      await tx.userCompetency.upsert({
        where: { userId_competencyId: { userId, competencyId: change.competencyId } },
        update: { level: change.after, source: 'ASSESSMENT' },
        create: { userId, competencyId: change.competencyId, level: change.after, source: 'ASSESSMENT' },
      });
    }
    await audit(tx, {
      actorId: userId,
      action: 'ASSESSMENT_SUBMITTED',
      entityType: 'Assessment',
      entityId: id,
      metadata: { score: scored.score, maxScore: scored.maxScore },
    });
  });

  return getResult(userId, id);
}

// The trainee's result: only after submitting. Now the correct answers can be shown.
export async function getResult(userId: string, id: string) {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { assessmentId_userId: { assessmentId: id, userId } },
    include: {
      assessment: {
        include: {
          course: { select: { id: true, title: true } },
          questions: { include: questionInclude, orderBy: { order: 'asc' } },
        },
      },
    },
  });
  if (!attempt?.submittedAt) throw AppError.notFound('No submitted attempt for this assessment');

  const { assessment } = attempt;
  const answers = new Map((attempt.answers as unknown as AnswerRecord[]).map((a) => [a.questionId, a]));
  const names = new Map(assessment.questions.map((q) => [q.competency.id, q.competency.name]));
  const results = (attempt.competencyResults as unknown as StoredCompetencyResult[]).map((r) => ({ ...r, competencyName: names.get(r.competencyId) ?? 'Unknown' }));
  const percent = attempt.maxScore ? Math.round(((attempt.score ?? 0) / attempt.maxScore) * 1000) / 10 : 0;

  return {
    assessment: { id: assessment.id, title: assessment.title, passPercent: assessment.passPercent, course: assessment.course },
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent,
    passed: percent >= assessment.passPercent,
    competencies: results,
    strongIn: results.filter((r) => r.strength === 'STRONG').map((r) => r.competencyName),
    weakIn: results.filter((r) => r.strength === 'WEAK').map((r) => r.competencyName),
    questions: assessment.questions.map((q) => {
      const a = answers.get(q.id);
      return {
        ...safeQuestion(q),
        correctOptionId: q.correctOptionId,
        explanation: q.explanation,
        selectedOptionId: a?.selectedOptionId ?? null,
        correct: a?.correct ?? false,
      };
    }),
  };
}

// Open assessments across the trainee's courses that still need an answer.
export async function myAssessments(userId: string) {
  const enrollments = await prisma.enrollment.findMany({ where: { userId, status: { not: 'DROPPED' } }, select: { courseId: true } });
  const assessments = await prisma.assessment.findMany({
    where: { published: true, courseId: { in: enrollments.map((e) => e.courseId) } },
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { questions: true } },
      attempts: { where: { userId }, select: { startedAt: true, submittedAt: true, score: true, maxScore: true } },
    },
    orderBy: { deadline: 'asc' },
  });
  return assessments.map(({ attempts, ...a }) => {
    const mine = attempts[0] ?? null;
    const status = mine?.submittedAt ? 'SUBMITTED' : a.deadline.getTime() < Date.now() ? 'MISSED' : mine ? 'IN_PROGRESS' : 'NOT_STARTED';
    return { ...a, myAttempt: mine, status };
  });
}
