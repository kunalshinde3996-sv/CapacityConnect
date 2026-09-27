import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, auth, createAdmin, createUser, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function session(role: 'TRAINEE' | 'TRAINER') {
  const user = await createUser({ role });
  const { accessToken } = await loginAs(user.email);
  return { user, token: accessToken };
}

// A course with 4 enrolled trainees and one open assessment (radar x2, QC x2):
//   Asha: submitted, radar 2/2, QC 0/2   -> 50%
//   Ben:  submitted, radar 2/2, QC 1/2   -> 75%
//   Chen: started, not submitted          -> IN_PROGRESS
//   Dev:  not started                     -> PENDING
// plus a closed assessment nobody took     -> everyone MISSED
async function setup() {
  const radar = await prisma.competency.create({ data: { name: 'Radar Meteorology', category: 'DOMAIN', description: 'x' } });
  const qc = await prisma.competency.create({ data: { name: 'Data Quality Control', category: 'FUNCTIONAL', description: 'x' } });
  const trainer = await session('TRAINER');
  const course = await prisma.course.create({
    data: { title: 'DWR Basics', description: 'x', status: 'PUBLISHED', createdById: trainer.user.id, trainerId: trainer.user.id },
  });

  const names = ['Asha', 'Ben', 'Chen', 'Dev'];
  const trainees = [];
  for (const name of names) {
    const u = await createUser({ role: 'TRAINEE', email: `${name.toLowerCase()}@moes.test` });
    await prisma.user.update({ where: { id: u.id }, data: { fullName: name } });
    await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id } });
    trainees.push(u);
  }

  const q = (competencyId: string, order: number) => ({
    competencyId,
    order,
    text: `Question ${order}`,
    options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    correctOptionId: 'a',
  });
  const open = await prisma.assessment.create({
    data: {
      courseId: course.id,
      title: 'Open quiz',
      deadline: new Date(Date.now() + 86_400_000),
      published: true,
      passPercent: 60,
      createdById: trainer.user.id,
      questions: { create: [q(radar.id, 1), q(radar.id, 2), q(qc.id, 3), q(qc.id, 4)] },
    },
  });
  await prisma.assessment.create({
    data: { courseId: course.id, title: 'Closed quiz', deadline: new Date(Date.now() - 86_400_000), published: true, createdById: trainer.user.id, questions: { create: [q(radar.id, 1)] } },
  });

  const result = (competencyId: string, obtained: number) => ({ competencyId, questions: 2, correct: obtained, marksObtained: obtained, maxMarks: 2, percent: obtained * 50 });
  const submitted = (userId: string, qcMarks: number) =>
    prisma.assessmentAttempt.create({
      data: {
        assessmentId: open.id,
        userId,
        submittedAt: new Date(),
        score: 2 + qcMarks,
        maxScore: 4,
        answers: [],
        competencyResults: [result(radar.id, 2), result(qc.id, qcMarks)],
      },
    });
  await submitted(trainees[0]!.id, 0);
  await submitted(trainees[1]!.id, 1);
  await prisma.assessmentAttempt.create({ data: { assessmentId: open.id, userId: trainees[2]!.id } });

  return { trainer, course, open };
}

describe('GET /api/courses/:id/progress', () => {
  it('shows who attempted, who is pending, scores and averages', async () => {
    const { trainer, course, open } = await setup();
    const res = await request(app).get(`/api/courses/${course.id}/progress`).set(auth(trainer.token));

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ enrolled: 4, assessments: 2, submissions: 2, averagePercent: 62.5, outstanding: 2 });

    const openSummary = res.body.assessments.find((a: { id: string }) => a.id === open.id);
    expect(openSummary).toMatchObject({ submitted: 2, inProgress: 1, pending: 1, missed: 0, averagePercent: 62.5, passRate: 50 });
    const closed = res.body.assessments.find((a: { title: string }) => a.title === 'Closed quiz');
    expect(closed).toMatchObject({ submitted: 0, missed: 4, closed: true });

    const rows = Object.fromEntries(
      res.body.trainees.map((t: { user: { fullName: string }; results: { assessmentId: string; status: string; percent: number | null }[] }) => [
        t.user.fullName,
        t.results.find((r) => r.assessmentId === open.id),
      ]),
    );
    expect(rows.Asha).toMatchObject({ status: 'SUBMITTED', percent: 50 });
    expect(rows.Ben).toMatchObject({ status: 'SUBMITTED', percent: 75 });
    expect(rows.Chen).toMatchObject({ status: 'IN_PROGRESS', percent: null });
    expect(rows.Dev).toMatchObject({ status: 'PENDING', percent: null });
  });

  it('ranks the class competencies weakest first', async () => {
    const { trainer, course } = await setup();
    const res = await request(app).get(`/api/courses/${course.id}/progress`).set(auth(trainer.token));
    // QC: 1 of 4 marks = 25%; radar: 4 of 4 = 100%
    expect(res.body.competencies).toEqual([
      expect.objectContaining({ name: 'Data Quality Control', percent: 25, traineesAssessed: 2 }),
      expect.objectContaining({ name: 'Radar Meteorology', percent: 100, traineesAssessed: 2 }),
    ]);
  });

  it('is only for the course trainer or an admin', async () => {
    const { course } = await setup();
    const other = await session('TRAINER');
    const trainee = await prisma.user.findFirstOrThrow({ where: { fullName: 'Asha' } });
    const traineeToken = (await loginAs(trainee.email)).accessToken;
    const { token: adminToken } = await createAdmin();

    expect((await request(app).get(`/api/courses/${course.id}/progress`).set(auth(other.token))).status).toBe(403);
    expect((await request(app).get(`/api/courses/${course.id}/progress`).set(auth(traineeToken))).status).toBe(403);
    expect((await request(app).get(`/api/courses/${course.id}/progress`).set(auth(adminToken))).status).toBe(200);
  });
});
