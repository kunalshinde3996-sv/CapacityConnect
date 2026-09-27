// Idempotent demo seed: safe to run any number of times.
// Every row is matched on a natural key (email, code, name...) and created or updated,
// so re-running resets the demo data to a known state without duplicating anything.
//
//   npm run db:seed -w apps/api
//
// Note: re-running resets demo users' passwords and statuses (e.g. a pending user you
// approved during a demo goes back to PENDING). Users you created yourself are untouched.

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { type CompetencySource, PrismaClient, type UserStatus } from '../src/generated/prisma/client.js';
import { levelUpdates, scoreAttempt, strengthOf } from '../src/services/assessment/scoring.js';
import { validateRequirements } from '../src/services/matching/matching.js';
import { assessments as seedAssessmentList } from './seed-assessments.js';
import { announcements as seedAnnouncementList } from './seed-announcements.js';
import { CHECKUP_DEADLINE_HOURS, CHECKUP_TITLE, checkupQuestions, CLOSED_QUIZ, DEMO_COMPETENCY, DEMO_COURSE, DEMO_STATION, DEMO_TRAINEE, IMPROVED_COUNT } from './seed-demo.js';
import { courseFeedback } from './seed-feedback.js';
import {
  competencies,
  competencyTargets,
  courses,
  DEFAULT_TARGET_LEVEL,
  DEMO_PASSWORD,
  documentFiles,
  institutes,
  interestPool,
  libraryItems,
  PENDING_TRAINEE_COUNT,
  subjects,
  traineeDesignations,
  traineeNames,
  traineeExtras,
  trainers,
} from './seed-data.js';

// Demo files live in apps/api/demo-files; the API copies them into storage at startup
// (src/modules/storage/demoFiles.ts). The seed only records their storage keys.
const DEMO_FILES_DIR = fileURLToPath(new URL('../demo-files/', import.meta.url));
const demoFileKey = (fileName: string | undefined) => (fileName ? `demo/${fileName}` : null);

// Variables already set in the shell win over .env, so a hosted DATABASE_URL
// passed on the command line is the one used.
if (existsSync('.env')) process.loadEnvFile('.env');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

// A database that is not on this machine is treated as a real (hosted) one. We check the
// host rather than NODE_ENV, because the hosted seed is usually run from a laptop.
const dbHost = new URL(process.env.DATABASE_URL).hostname;
const isRemote = !['localhost', '127.0.0.1', '::1', 'db'].includes(dbHost);

if (isRemote && process.env.SEED_ALLOW_PROD !== 'true') {
  console.error(`Refusing to seed the remote database at ${dbHost}. Set SEED_ALLOW_PROD=true if you really mean it.`);
  process.exit(1);
}

// The public demo password (in the README) is only allowed locally. A live site gets
// its own password, so nobody reading the repo can sign in as admin there.
function chooseDemoPassword(): string {
  if (!isRemote) return DEMO_PASSWORD;
  const secret = process.env.SEED_DEMO_PASSWORD;
  if (!secret || secret.length < 12 || secret === DEMO_PASSWORD) {
    console.error('Seeding a remote database needs SEED_DEMO_PASSWORD (12+ characters, not the public demo password).');
    process.exit(1);
  }
  return secret;
}
const demoPassword = chooseDemoPassword();

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Filled at the start of main() and shared by upsertUser()
const instituteIds = new Map<string, string>();
let passwordHash = '';

// Small deterministic random generator: same "random" trainee levels on every run.
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emailFor(name: string, domain: string) {
  const local = name.toLowerCase().replace(/^dr\.\s*/, '').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
  return `${local}@${domain}`;
}

async function main() {
  const started = Date.now();
  // One hash reused for every demo account: all share the demo password, and
  // hashing 49 times would just make the seed slow.
  passwordHash = await bcrypt.hash(demoPassword, 10);

  // ── Institutes ────────────────────────────────────────────
  for (const { domain: _domain, ...inst } of institutes) {
    const row = await prisma.institute.upsert({ where: { code: inst.code }, update: inst, create: inst });
    instituteIds.set(inst.code, row.id);
  }

  // ── Competency framework ──────────────────────────────────
  const competencyIds = new Map<string, string>();
  for (const c of competencies) {
    const targetLevel = competencyTargets[c.name] ?? DEFAULT_TARGET_LEVEL;
    const row = await prisma.competency.upsert({
      where: { name: c.name },
      update: { category: c.category, description: c.description, isActive: true, targetLevel },
      create: { ...c, targetLevel },
    });
    competencyIds.set(c.name, row.id);
  }
  const competencyId = (name: string) => {
    const id = competencyIds.get(name);
    if (!id) throw new Error(`Unknown competency in seed data: ${name}`);
    return id;
  };

  // ── Admin ─────────────────────────────────────────────────
  const adminEmail = 'admin@moes.example';
  const admin = await upsertUser({
    email: adminEmail,
    fullName: 'Capacity Connect Admin',
    role: 'ADMIN',
    status: 'APPROVED',
    designation: 'Training Coordinator',
    instituteCode: 'IMD-PUNE',
  });

  // ── Subjects and requirements ─────────────────────────────
  for (const s of subjects) {
    // Same validation the matching engine uses, so seed data can never break rankings.
    validateRequirements(
      s.requirements.map(([name, minLevel, weight]) => ({ competencyId: competencyId(name), competencyName: name, minLevel, weight: Number(weight) })),
    );

    const subject = await prisma.subject.upsert({
      where: { name: s.name },
      update: { description: s.description },
      create: { name: s.name, description: s.description },
    });
    const wanted = s.requirements.map(([name]) => competencyId(name));
    // Drop requirements removed from the seed data, so weights still sum to 1.
    await prisma.subjectRequirement.deleteMany({ where: { subjectId: subject.id, competencyId: { notIn: wanted } } });
    for (const [name, minLevel, weight] of s.requirements) {
      await prisma.subjectRequirement.upsert({
        where: { subjectId_competencyId: { subjectId: subject.id, competencyId: competencyId(name) } },
        update: { minLevel, weight },
        create: { subjectId: subject.id, competencyId: competencyId(name), minLevel, weight },
      });
    }
  }

  // ── Trainers with evidence-backed claims ──────────────────
  const trainerLogins: { name: string; email: string; institute: string }[] = [];
  for (const t of trainers) {
    const domain = institutes.find((i) => i.code === t.institute)!.domain;
    const email = `${t.emailLocal}@${domain}`;
    const user = await upsertUser({
      email,
      fullName: t.fullName,
      role: 'TRAINER',
      status: 'APPROVED',
      designation: t.designation,
      instituteCode: t.institute,
    });
    trainerLogins.push({ name: t.fullName, email, institute: t.institute });

    await prisma.trainerProfile.upsert({
      where: { userId: user.id },
      update: { headline: t.headline, yearsOfExperience: t.years },
      create: { userId: user.id, headline: t.headline, yearsOfExperience: t.years },
    });

    for (const claim of t.claims) {
      const verified = claim.verified ?? false;
      const review = verified ? { verifiedById: admin.id, verifiedAt: new Date() } : { verifiedById: null, verifiedAt: null };
      let certificateId: string | null = null;
      let qualificationId: string | null = null;

      if (claim.document && claim.evidence === 'CERTIFICATE') {
        const data = {
          userId: user.id,
          title: claim.document.title,
          issuer: claim.document.issuer,
          issuedOn: new Date(`${claim.document.year}-06-01`),
          fileKey: demoFileKey(documentFiles[claim.document.title]),
          status: verified ? ('VERIFIED' as const) : ('PENDING' as const),
          ...review,
        };
        const existing = await prisma.certificate.findFirst({ where: { userId: user.id, title: data.title } });
        certificateId = existing
          ? (await prisma.certificate.update({ where: { id: existing.id }, data })).id
          : (await prisma.certificate.create({ data })).id;
      }

      if (claim.document && claim.evidence === 'QUALIFICATION') {
        const [degree, ...field] = claim.document.title.split(' ');
        const data = {
          userId: user.id,
          degree: degree!,
          fieldOfStudy: field.join(' '),
          institution: claim.document.issuer,
          yearCompleted: claim.document.year,
          fileKey: demoFileKey(documentFiles[claim.document.title]),
          status: verified ? ('VERIFIED' as const) : ('PENDING' as const),
          ...review,
        };
        const existing = await prisma.qualification.findFirst({ where: { userId: user.id, degree: data.degree, fieldOfStudy: data.fieldOfStudy } });
        qualificationId = existing
          ? (await prisma.qualification.update({ where: { id: existing.id }, data })).id
          : (await prisma.qualification.create({ data })).id;
      }

      const claimData = {
        level: claim.level,
        evidenceType: claim.evidence,
        verified,
        evidenceNote: claim.note,
        certificateId,
        qualificationId,
        ...review,
      };
      await prisma.trainerCompetency.upsert({
        where: { userId_competencyId: { userId: user.id, competencyId: competencyId(claim.competency) } },
        update: claimData,
        create: { userId: user.id, competencyId: competencyId(claim.competency), ...claimData },
      });
    }
  }

  // ── Trainees ──────────────────────────────────────────────
  const teachableCompetencies = [...new Set(subjects.flatMap((s) => s.requirements.map(([name]) => name)))];
  const random = seededRandom(2026);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  const traineeLogins: { name: string; email: string; status: UserStatus }[] = [];

  for (const [index, name] of traineeNames.entries()) {
    const institute = institutes[index % institutes.length]!;
    const email = emailFor(name, institute.domain);
    // The last few trainees are waiting for approval
    const status: UserStatus = index >= traineeNames.length - PENDING_TRAINEE_COUNT ? 'PENDING' : 'APPROVED';
    const user = await upsertUser({
      email,
      fullName: name,
      role: 'TRAINEE',
      status,
      designation: pick(traineeDesignations),
      instituteCode: institute.code,
    });
    traineeLogins.push({ name, email, status });

    const interests = [...new Set([pick(interestPool), pick(interestPool), pick(interestPool)])];
    await prisma.traineeProfile.upsert({
      where: { userId: user.id },
      update: { interests, employeeId: `EMP${String(1001 + index)}` },
      create: { userId: user.id, interests, employeeId: `EMP${String(1001 + index)}` },
    });

    // 3-5 self-assessed competency levels per approved trainee (for the future skill-gap view)
    if (status === 'APPROVED') {
      const count = 3 + Math.floor(random() * 3);
      const chosen = new Set<string>();
      // Only competencies some subject requires, so every gap in the skill-gap view is actionable.
      while (chosen.size < count) chosen.add(pick(teachableCompetencies));
      // Remove self-assessed skills from earlier runs that were not chosen this time,
      // so re-running the seed always gives the same state.
      await prisma.userCompetency.deleteMany({
        where: { userId: user.id, source: 'SELF_ASSESSED', competencyId: { notIn: [...chosen].map(competencyId) } },
      });
      for (const compName of chosen) {
        const level = 1 + Math.floor(random() * 3); // trainees are mostly level 1-3
        const source: CompetencySource = 'SELF_ASSESSED';
        await prisma.userCompetency.upsert({
          where: { userId_competencyId: { userId: user.id, competencyId: competencyId(compName) } },
          update: { level, source },
          create: { userId: user.id, competencyId: competencyId(compName), level, source },
        });
      }
    }

    const extra = traineeExtras[name];
    if (extra) await seedTraineeExtra(user.id, admin.id, extra);
  }

  // ── Courses and enrolments ────────────────────────────────
  await seedCourses(competencyId);
  await seedLibrary(competencyId);
  await seedAssessments();
  await seedDemoScenario();
  await seedFeedback();
  await seedCompletions();
  await seedCommunication(admin.id);

  // ── Summary ───────────────────────────────────────────────
  const counts = {
    institutes: await prisma.institute.count(),
    competencies: await prisma.competency.count(),
    subjects: await prisma.subject.count(),
    trainers: await prisma.user.count({ where: { role: 'TRAINER' } }),
    trainees: await prisma.user.count({ where: { role: 'TRAINEE' } }),
    pending: await prisma.user.count({ where: { status: 'PENDING' } }),
    claims: await prisma.trainerCompetency.count(),
    courses: await prisma.course.count(),
    enrolments: await prisma.enrollment.count(),
    libraryItems: await prisma.libraryItem.count(),
    assessments: await prisma.assessment.count(),
    attempts: await prisma.assessmentAttempt.count(),
    feedback: await prisma.feedback.count(),
  };

  console.log(`\nSeed complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.table(counts);
  // Never print the private password used for a hosted database.
  console.log(`\nDemo logins (password for all: ${isRemote ? 'the SEED_DEMO_PASSWORD you set' : DEMO_PASSWORD})\n`);
  console.table([
    { role: 'ADMIN', name: 'Capacity Connect Admin', email: adminEmail, status: 'APPROVED' },
    ...trainerLogins.map((t) => ({ role: 'TRAINER', name: t.name, email: t.email, status: 'APPROVED' })),
    ...traineeLogins.slice(0, 3).map((t) => ({ role: 'TRAINEE', name: t.name, email: t.email, status: t.status })),
    ...traineeLogins
      .filter((t) => t.status === 'PENDING')
      .map((t) => ({ role: 'TRAINEE', name: t.name, email: t.email, status: 'PENDING (cannot log in yet)' })),
  ]);
  console.log('(Other trainees follow the same email pattern: firstname.lastname@<institute>.example)\n');
}

// Demo trainee for the end-to-end journey: enrolled in the radar and cyber courses,
// and deliberately NOT in the ocean course, so "browse and enrol" can be shown.
const JOURNEY_TRAINEE = 'aditya.sharma@imd.example';
const JOURNEY_ENROLLED = ['DWR Operations for Forecasters', 'Cyber Hygiene for Observing Networks'];

async function seedCourses(competencyId: (name: string) => string) {
  const random = seededRandom(77);
  const trainees = await prisma.user.findMany({
    where: { role: 'TRAINEE', status: 'APPROVED', email: { endsWith: '.example' } },
    orderBy: { email: 'asc' },
    select: { id: true, email: true },
  });
  const courseIds = new Map<string, string>();

  for (const c of courses) {
    const trainer = await prisma.user.findUniqueOrThrow({ where: { email: c.trainerEmail } });
    const subject = c.subject ? await prisma.subject.findUniqueOrThrow({ where: { name: c.subject }, include: { requirements: true } }) : null;
    const data = {
      title: c.title,
      description: c.description,
      status: c.status,
      subjectId: subject?.id ?? null,
      trainerId: trainer.id,
      createdById: trainer.id,
      instituteId: trainer.instituteId,
      startDate: new Date(c.start),
      endDate: new Date(c.end),
      capacity: c.capacity,
    };
    const existing = await prisma.course.findFirst({ where: { title: c.title } });
    const course = existing
      ? await prisma.course.update({ where: { id: existing.id }, data })
      : await prisma.course.create({ data });
    courseIds.set(c.title, course.id);

    // Modules are matched on their position, so re-seeding keeps their ids (library items link to them).
    for (const [index, [title, description]] of c.modules.entries()) {
      await prisma.courseModule.upsert({
        where: { courseId_order: { courseId: course.id, order: index + 1 } },
        update: { title, description },
        create: { courseId: course.id, order: index + 1, title, description },
      });
    }
    await prisma.courseModule.deleteMany({ where: { courseId: course.id, order: { gt: c.modules.length } } });

    const tags: [string, number][] = subject
      ? subject.requirements.map((r) => [r.competencyId, r.minLevel])
      : (c.extraCompetencies ?? []).map(([name, level]) => [competencyId(name), level]);
    await prisma.courseCompetency.deleteMany({ where: { courseId: course.id, competencyId: { notIn: tags.map(([id]) => id) } } });
    for (const [id, targetLevel] of tags) {
      await prisma.courseCompetency.upsert({
        where: { courseId_competencyId: { courseId: course.id, competencyId: id } },
        update: { targetLevel },
        create: { courseId: course.id, competencyId: id, targetLevel },
      });
    }

    // Deterministic enrolments: the same trainees every run.
    const planned = new Set(
      trainees
        .filter((t) =>
          t.email === JOURNEY_TRAINEE ? JOURNEY_ENROLLED.includes(c.title) : c.status === 'PUBLISHED' && random() < c.enrolFraction,
        )
        .map((t) => t.id),
    );
    // Reset demo enrolments to the plan (removes enrolments made during a demo).
    await prisma.enrollment.deleteMany({ where: { courseId: course.id, userId: { in: trainees.map((t) => t.id) }, NOT: { userId: { in: [...planned] } } } });
    for (const userId of planned) {
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId, courseId: course.id } },
        update: { status: 'ENROLLED', completedAt: null },
        create: { userId, courseId: course.id, enrolledAt: new Date(c.start) },
      });
    }
  }
  return courseIds;
}

// ── Assessments with simulated attempts ────────────────────
// Scored with the same pure functions as the API (services/assessment/scoring.ts), so the
// seeded results, per-competency breakdowns and skill levels follow the real rules.

const OPTION_IDS = ['a', 'b', 'c', 'd'];

// A deadline `days` from today at 17:30 local time (negative = in the past).
function dayAt(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(17, 30, 0, 0);
  return d;
}

async function seedAssessments() {
  const random = seededRandom(404);
  const competencyIds = new Map((await prisma.competency.findMany()).map((c) => [c.name, c.id]));
  const demoTrainees = await prisma.user.findMany({
    where: { role: 'TRAINEE', email: { endsWith: '.example' } },
    orderBy: { email: 'asc' },
    select: { id: true, email: true },
  });
  // Levels measured by earlier seed runs are removed, so every run gives the same results.
  await prisma.userCompetency.deleteMany({ where: { source: 'ASSESSMENT', userId: { in: demoTrainees.map((t) => t.id) } } });
  // Each demo trainee gets a fixed "ability" (chance of answering correctly).
  const ability = new Map(demoTrainees.map((t) => [t.id, 0.45 + random() * 0.5]));
  const journey = demoTrainees.find((t) => t.email === JOURNEY_TRAINEE);

  // Oldest deadlines first, so skill levels build up in the order attempts happened.
  for (const a of [...seedAssessmentList].sort((x, y) => x.deadlineDays - y.deadlineDays)) {
    const course = await prisma.course.findFirstOrThrow({ where: { title: a.course } });
    const trainer = await prisma.user.findUniqueOrThrow({ where: { id: course.trainerId! } });
    const deadline = dayAt(a.deadlineDays);
    const data = {
      courseId: course.id,
      title: a.title,
      description: a.description,
      deadline,
      durationMinutes: a.durationMinutes,
      passPercent: 60,
      published: a.published,
      createdById: trainer.id,
    };

    // Reset: re-create questions and attempts on every run.
    const existing = await prisma.assessment.findFirst({ where: { courseId: course.id, title: a.title } });
    if (existing) {
      await prisma.assessmentAttempt.deleteMany({ where: { assessmentId: existing.id } });
      await prisma.question.deleteMany({ where: { assessmentId: existing.id } });
    }
    const assessment = existing
      ? await prisma.assessment.update({ where: { id: existing.id }, data })
      : await prisma.assessment.create({ data });

    const questions = [];
    for (const [i, [text, competency, options, correctIndex, explanation]] of a.questions.entries()) {
      // Rotate the options by a hash of the question text, so the correct answer's position
      // looks random (no a-b-c-d pattern) but is the same on every seed run.
      const shift = [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % options.length;
      const rotated = options.map((_, j) => options[(j + shift) % options.length]!);
      const correctPosition = (correctIndex - shift + options.length) % options.length;
      questions.push(
        await prisma.question.create({
          data: {
            assessmentId: assessment.id,
            order: i + 1,
            text,
            competencyId: competencyIds.get(competency)!,
            options: rotated.map((t, j) => ({ id: OPTION_IDS[j]!, text: t })),
            correctOptionId: OPTION_IDS[correctPosition]!,
            marks: 1,
            explanation,
          },
        }),
      );
    }
    if (!a.published) continue;

    // Who submitted: a deterministic share of the enrolled demo trainees. The journey
    // trainee has results for closed assessments, and open ones are left for the demo.
    const enrolled = await prisma.enrollment.findMany({
      where: { courseId: course.id, status: { not: 'DROPPED' }, userId: { in: demoTrainees.map((t) => t.id) } },
      orderBy: { user: { email: 'asc' } },
    });
    const isOpen = deadline.getTime() > Date.now();
    for (const e of enrolled) {
      const isJourney = e.userId === journey?.id;
      const attempts = isJourney ? !isOpen : random() < a.attemptShare;
      if (!attempts) continue;

      const answers: Record<string, string> = {};
      for (const q of questions) {
        const competencyName = [...competencyIds].find(([, cid]) => cid === q.competencyId)![0];
        const p = Math.min(0.97, ability.get(e.userId)! * (a.difficulty?.[competencyName] ?? 1) + 0.1);
        const wrong = OPTION_IDS.filter((o) => o !== q.correctOptionId);
        answers[q.id] = random() < p ? q.correctOptionId : wrong[Math.floor(random() * wrong.length)]!;
      }
      const scored = scoreAttempt(questions, answers);
      const current = await prisma.userCompetency.findMany({ where: { userId: e.userId, competencyId: { in: scored.competencyResults.map((r) => r.competencyId) } } });
      const changes = levelUpdates(scored.competencyResults, new Map(current.map((c) => [c.competencyId, { level: c.level, source: c.source }])));
      const byCompetency = new Map(changes.map((c) => [c.competencyId, c]));

      const end = Math.min(deadline.getTime(), Date.now()) - Math.floor(random() * 4 * 86_400_000) - 3_600_000;
      const startedAt = new Date(end - (8 + Math.floor(random() * 10)) * 60_000);
      await prisma.assessmentAttempt.create({
        data: {
          assessmentId: assessment.id,
          userId: e.userId,
          startedAt,
          submittedAt: new Date(end),
          score: scored.score,
          maxScore: scored.maxScore,
          answers: scored.answers as unknown as object,
          competencyResults: scored.competencyResults.map((r) => {
            const c = byCompetency.get(r.competencyId);
            return {
              ...r,
              strength: strengthOf(r.percent),
              level: c ? { before: c.before, after: c.after, measured: c.measured, write: c.write, levelChanged: c.levelChanged, reason: c.reason } : null,
            };
          }),
        },
      });
      for (const c of changes.filter((x) => x.write)) {
        await prisma.userCompetency.upsert({
          where: { userId_competencyId: { userId: e.userId, competencyId: c.competencyId } },
          update: { level: c.after, source: 'ASSESSMENT' },
          create: { userId: e.userId, competencyId: c.competencyId, level: c.after, source: 'ASSESSMENT' },
        });
      }
    }
  }
}

// Homepage announcements (matched on title) and a first set of in-app notifications for the
// journey trainee. Demo users' notifications are reset, so reminders are created afresh.
async function seedCommunication(adminId: string) {
  for (const a of seedAnnouncementList) {
    const data = {
      type: a.type,
      title: a.title,
      body: a.body,
      linkUrl: a.linkUrl ?? null,
      published: a.daysAgo !== null,
      publishedAt: a.daysAgo === null ? null : new Date(Date.now() - a.daysAgo * 86_400_000),
      createdById: adminId,
    };
    const existing = await prisma.announcement.findFirst({ where: { title: a.title } });
    if (existing) await prisma.announcement.update({ where: { id: existing.id }, data });
    else await prisma.announcement.create({ data });
  }

  await prisma.notification.deleteMany({ where: { user: { email: { endsWith: '.example' } } } });
  const aditya = await prisma.user.findUniqueOrThrow({ where: { email: JOURNEY_TRAINEE } });
  const dwr = await prisma.course.findFirstOrThrow({ where: { title: 'DWR Operations for Forecasters' } });
  const open = await prisma.assessment.findFirstOrThrow({ where: { courseId: dwr.id, title: 'Reading radar products' } });
  await prisma.notification.createMany({
    data: [
      {
        userId: aditya.id,
        type: 'ENROLMENT_CONFIRMED',
        title: `Enrolled: ${dwr.title}`,
        body: `You are enrolled in "${dwr.title}". Its materials and assessments are on the course page.`,
        link: `/courses/${dwr.id}`,
        readAt: new Date(),
        createdAt: new Date(Date.now() - 20 * 86_400_000),
      },
      {
        userId: aditya.id,
        type: 'NEW_ASSESSMENT',
        title: `New assessment: ${open.title}`,
        body: `"${open.title}" is now open in "${dwr.title}".`,
        link: `/assessments/${open.id}`,
        dedupeKey: `assessment:${open.id}:${aditya.id}`,
        createdAt: new Date(Date.now() - 2 * 86_400_000),
      },
    ],
  });
}

// Course completions: in courses whose assessment has closed, trainees who passed are marked
// completed and get a course certificate (as a trainer would do from Class progress).
const COMPLETION_COURSES = ['AWS Installation and Field Calibration', 'Tsunami Warning Centre Operations'];

async function seedCompletions() {
  const demo = { email: { endsWith: '.example' } };
  // Reset: remove course certificates of demo trainees from earlier runs.
  await prisma.certificate.deleteMany({ where: { courseId: { not: null }, user: demo } });

  for (const title of COMPLETION_COURSES) {
    const course = await prisma.course.findFirstOrThrow({ where: { title }, include: { assessments: { include: { attempts: true } } } });
    const passed = new Set(
      course.assessments.flatMap((a) =>
        a.attempts.filter((t) => t.submittedAt && t.maxScore && (t.score ?? 0) / t.maxScore >= a.passPercent / 100).map((t) => t.userId),
      ),
    );
    const enrollments = await prisma.enrollment.findMany({ where: { courseId: course.id, userId: { in: [...passed] }, user: demo } });
    for (const e of enrollments) {
      const completedAt = new Date(Date.now() - 2 * 86_400_000);
      await prisma.enrollment.update({ where: { id: e.id }, data: { status: 'COMPLETED', completedAt } });
      await prisma.certificate.create({
        data: {
          userId: e.userId,
          courseId: course.id,
          title: `Course completion: ${course.title}`,
          issuer: 'Capacity Connect (MoES)',
          issuedOn: completedAt,
          status: 'VERIFIED',
          verifiedById: course.trainerId,
          verifiedAt: completedAt,
        },
      });
    }
  }
}

// The DEMO.md scenario at NCPOR Goa (see prisma/seed-demo.ts). Runs after the random
// assessment simulation and replaces it for the Goa trainees, so the story is exact.
async function seedDemoScenario() {
  const station = await prisma.institute.findUniqueOrThrow({ where: { code: DEMO_STATION } });
  const aws = await prisma.competency.findUniqueOrThrow({ where: { name: DEMO_COMPETENCY } });
  const course = await prisma.course.findFirstOrThrow({ where: { title: DEMO_COURSE } });
  const trainer = await prisma.user.findUniqueOrThrow({ where: { id: course.trainerId! } });
  const competencyIds = new Map((await prisma.competency.findMany()).map((c) => [c.name, c.id]));

  // Goa trainees in the story: approved demo trainees, except Rohan (his trainer application
  // is a separate demo). The demo trainee is never among those who already improved.
  const goa = await prisma.user.findMany({
    where: { role: 'TRAINEE', status: 'APPROVED', instituteId: station.id, email: { endsWith: '.example', not: 'rohan.patil@ncpor.example' } },
    orderBy: { email: 'asc' },
  });
  // The rest (including the demo trainee) have not taken the course questionnaire yet.
  const improved = goa.filter((u) => u.email !== DEMO_TRAINEE).slice(0, IMPROVED_COUNT);

  // Everyone in the story is enrolled in the AWS course.
  for (const u of goa) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: u.id, courseId: course.id } },
      update: { status: 'ENROLLED', completedAt: null },
      create: { userId: u.id, courseId: course.id, enrolledAt: new Date(Date.now() - 30 * 86_400_000) },
    });
  }

  // The open check-up: due in CHECKUP_DEADLINE_HOURS, so the 24-hour reminder is active.
  const checkupData = {
    courseId: course.id,
    title: CHECKUP_TITLE,
    description: 'Five quick questions on calibration and data checks. Due soon!',
    deadline: new Date(Date.now() + CHECKUP_DEADLINE_HOURS * 3_600_000),
    durationMinutes: 15,
    passPercent: 60,
    published: true,
    createdById: trainer.id,
  };
  const existingCheckup = await prisma.assessment.findFirst({ where: { courseId: course.id, title: CHECKUP_TITLE } });
  if (existingCheckup) {
    await prisma.assessmentAttempt.deleteMany({ where: { assessmentId: existingCheckup.id } });
    await prisma.question.deleteMany({ where: { assessmentId: existingCheckup.id } });
  }
  const checkup = existingCheckup
    ? await prisma.assessment.update({ where: { id: existingCheckup.id }, data: checkupData })
    : await prisma.assessment.create({ data: checkupData });
  for (const [i, [text, competency, options, correctIndex, explanation]] of checkupQuestions.entries()) {
    const shift = (i * 2 + 1) % options.length; // correct answer in varying positions
    await prisma.question.create({
      data: {
        assessmentId: checkup.id,
        order: i + 1,
        text,
        competencyId: competencyIds.get(competency)!,
        options: options.map((_, j) => ({ id: OPTION_IDS[j]!, text: options[(j + shift) % options.length]! })),
        correctOptionId: OPTION_IDS[(correctIndex - shift + options.length) % options.length]!,
        explanation,
      },
    });
  }

  // Before the course: every Goa trainee is below target in AWS Calibration.
  for (const [i, u] of goa.entries()) {
    const level = improved.includes(u) ? 1 : u.email === DEMO_TRAINEE ? 2 : 1 + (i % 2);
    await prisma.userCompetency.upsert({
      where: { userId_competencyId: { userId: u.id, competencyId: aws.id } },
      update: { level, source: 'SELF_ASSESSED' },
      create: { userId: u.id, competencyId: aws.id, level, source: 'SELF_ASSESSED' },
    });
  }

  // The closed course questionnaire: the "improved" trainees answered everything correctly,
  // the waiting ones have not taken it. Levels are updated by the real rule.
  const quiz = await prisma.assessment.findFirstOrThrow({ where: { courseId: course.id, title: CLOSED_QUIZ }, include: { questions: true } });
  await prisma.assessmentAttempt.deleteMany({ where: { assessmentId: quiz.id, userId: { in: goa.map((u) => u.id) } } });
  for (const u of improved) {
    const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, q.correctOptionId]));
    const scored = scoreAttempt(quiz.questions, answers);
    const current = await prisma.userCompetency.findMany({ where: { userId: u.id } });
    const changes = levelUpdates(scored.competencyResults, new Map(current.map((c) => [c.competencyId, { level: c.level, source: c.source }])));
    const byCompetency = new Map(changes.map((c) => [c.competencyId, c]));
    const submittedAt = new Date(quiz.deadline.getTime() - 2 * 86_400_000);
    await prisma.assessmentAttempt.create({
      data: {
        assessmentId: quiz.id,
        userId: u.id,
        startedAt: new Date(submittedAt.getTime() - 12 * 60_000),
        submittedAt,
        score: scored.score,
        maxScore: scored.maxScore,
        answers: scored.answers as unknown as object,
        competencyResults: scored.competencyResults.map((r) => {
          const c = byCompetency.get(r.competencyId);
          return { ...r, strength: strengthOf(r.percent), level: c ? { before: c.before, after: c.after, measured: c.measured, write: c.write, levelChanged: c.levelChanged, reason: c.reason } : null };
        }),
      },
    });
    for (const c of changes.filter((x) => x.write)) {
      await prisma.userCompetency.upsert({
        where: { userId_competencyId: { userId: u.id, competencyId: c.competencyId } },
        update: { level: c.after, source: 'ASSESSMENT' },
        create: { userId: u.id, competencyId: c.competencyId, level: c.after, source: 'ASSESSMENT' },
      });
    }
  }
}

// Ratings from the first enrolled demo trainees (not the journey trainee, who rates
// a course during the demo). Reset on every run.
async function seedFeedback() {
  for (const [title, entries] of Object.entries(courseFeedback)) {
    const course = await prisma.course.findFirstOrThrow({ where: { title } });
    const raters = await prisma.enrollment.findMany({
      where: { courseId: course.id, status: { not: 'DROPPED' }, user: { email: { endsWith: '.example', not: JOURNEY_TRAINEE } } },
      orderBy: { user: { email: 'asc' } },
      take: entries.length,
    });
    if (raters.length < entries.length) throw new Error(`Not enough enrolled trainees to seed feedback for ${title}`);
    await prisma.feedback.deleteMany({ where: { courseId: course.id, user: { email: { endsWith: '.example' } } } });
    await prisma.feedback.createMany({
      data: entries.map(([rating, comment], i) => ({
        courseId: course.id,
        userId: raters[i]!.userId,
        rating,
        comment,
        createdAt: new Date(Date.now() - (i + 1) * 36 * 3_600_000),
      })),
    });
  }
}

const MIME_BY_EXT: Record<string, string> = { '.pdf': 'application/pdf', '.mp4': 'video/mp4' };

// Library items backed by the demo files; matched on their storage key.
async function seedLibrary(competencyId: (name: string) => string) {
  for (const item of libraryItems) {
    const uploader = await prisma.user.findUniqueOrThrow({ where: { email: item.uploader } });
    const course = item.course ? await prisma.course.findFirst({ where: { title: item.course } }) : null;
    const module = course && item.moduleOrder
      ? await prisma.courseModule.findUnique({ where: { courseId_order: { courseId: course.id, order: item.moduleOrder } } })
      : null;
    const fileKey = demoFileKey(item.file)!;
    const data = {
      title: item.title,
      description: item.description,
      type: item.type,
      fileKey,
      mimeType: MIME_BY_EXT[path.extname(item.file)] ?? 'application/octet-stream',
      sizeBytes: statSync(path.join(DEMO_FILES_DIR, item.file)).size,
      isPublished: true,
      uploadedById: uploader.id,
      courseId: course?.id ?? null,
      moduleId: module?.id ?? null,
    };
    const existing = await prisma.libraryItem.findFirst({ where: { fileKey } });
    const saved = existing
      ? await prisma.libraryItem.update({ where: { id: existing.id }, data })
      : await prisma.libraryItem.create({ data });
    await prisma.libraryItemCompetency.deleteMany({ where: { libraryItemId: saved.id } });
    await prisma.libraryItemCompetency.createMany({
      data: item.competencies.map((name) => ({ libraryItemId: saved.id, competencyId: competencyId(name) })),
    });
  }
}

// Certificates, qualifications, experience and a trainer application for one trainee.
async function seedTraineeExtra(userId: string, adminId: string, extra: (typeof traineeExtras)[string]) {
  for (const c of extra.certificates ?? []) {
    const verified = c.status === 'VERIFIED';
    const data = {
      userId,
      title: c.title,
      issuer: c.issuer,
      issuedOn: new Date(`${c.year}-03-15`),
      fileKey: demoFileKey(c.file),
      status: c.status,
      verifiedById: verified ? adminId : null,
      verifiedAt: verified ? new Date() : null,
      rejectionReason: null,
    };
    const existing = await prisma.certificate.findFirst({ where: { userId, title: c.title } });
    if (existing) await prisma.certificate.update({ where: { id: existing.id }, data });
    else await prisma.certificate.create({ data });
  }

  for (const q of extra.qualifications ?? []) {
    const data = { userId, degree: q.degree, fieldOfStudy: q.fieldOfStudy, institution: q.institution, yearCompleted: q.year };
    const existing = await prisma.qualification.findFirst({ where: { userId, degree: q.degree, fieldOfStudy: q.fieldOfStudy } });
    if (existing) await prisma.qualification.update({ where: { id: existing.id }, data: { ...data, status: 'PENDING' } });
    else await prisma.qualification.create({ data });
  }

  for (const x of extra.experiences ?? []) {
    const data = { userId, organisation: x.organisation, title: x.title, startDate: new Date(x.from), endDate: x.to ? new Date(x.to) : null, description: x.description ?? null };
    const existing = await prisma.experience.findFirst({ where: { userId, organisation: x.organisation, title: x.title } });
    if (existing) await prisma.experience.update({ where: { id: existing.id }, data });
    else await prisma.experience.create({ data });
  }

  if (extra.application) {
    // Reset to one PENDING application, so the admin queue is ready for a demo.
    await prisma.trainerApplication.deleteMany({ where: { userId } });
    await prisma.trainerApplication.create({ data: { userId, motivation: extra.application } });
  }
}

async function upsertUser(u: {
  email: string;
  fullName: string;
  role: 'ADMIN' | 'TRAINER' | 'TRAINEE';
  status: UserStatus;
  designation: string;
  instituteCode: string;
}) {
  const data = {
    fullName: u.fullName,
    role: u.role,
    status: u.status,
    designation: u.designation,
    instituteId: instituteIds.get(u.instituteCode) ?? null,
    passwordHash,
  };
  return prisma.user.upsert({ where: { email: u.email }, update: data, create: { email: u.email, ...data } });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
