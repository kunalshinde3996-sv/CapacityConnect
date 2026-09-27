// Idempotent demo seed: safe to run any number of times.
// Every row is matched on a natural key (email, code, name...) and created or updated,
// so re-running resets the demo data to a known state without duplicating anything.
//
//   npm run db:seed -w apps/api
//
// Note: re-running resets demo users' passwords and statuses (e.g. a pending user you
// approved during a demo goes back to PENDING). Users you created yourself are untouched.

import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { type CompetencySource, PrismaClient, type UserStatus } from '../src/generated/prisma/client.js';
import { validateRequirements } from '../src/services/matching/matching.js';
import {
  competencies,
  courses,
  DEMO_PASSWORD,
  documentFiles,
  institutes,
  interestPool,
  PENDING_TRAINEE_COUNT,
  subjects,
  traineeDesignations,
  traineeNames,
  traineeExtras,
  trainers,
} from './seed-data.js';

// Demo files live in apps/api/demo-files; the API copies them into storage at startup
// (src/modules/storage/demoFiles.ts). The seed only records their storage keys.
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
    const row = await prisma.competency.upsert({
      where: { name: c.name },
      update: { category: c.category, description: c.description, isActive: true },
      create: c,
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
      while (chosen.size < count) chosen.add(pick(competencies).name);
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
