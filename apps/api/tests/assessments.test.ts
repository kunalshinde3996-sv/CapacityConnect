import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, auth, createUser, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const inAWeek = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

async function session(role: 'TRAINEE' | 'TRAINER') {
  const user = await createUser({ role });
  const { accessToken } = await loginAs(user.email);
  return { user, token: accessToken };
}

// A course with two competencies, an enrolled trainee, and a 5-question assessment:
// radar: q1 (a), q2 (b), q3 (c)   nowcast: q4 (a), q5 (b)
async function setup(extra: Record<string, unknown> = {}) {
  const radar = await prisma.competency.create({ data: { name: 'Radar Meteorology', category: 'DOMAIN', description: 'x' } });
  const nowcast = await prisma.competency.create({ data: { name: 'Nowcasting', category: 'DOMAIN', description: 'x' } });
  const other = await prisma.competency.create({ data: { name: 'Network Security', category: 'FUNCTIONAL', description: 'x' } });
  const trainer = await session('TRAINER');
  const course = await prisma.course.create({
    data: {
      title: 'DWR Basics',
      description: 'x',
      status: 'PUBLISHED',
      createdById: trainer.user.id,
      trainerId: trainer.user.id,
      competencies: { create: [{ competencyId: radar.id, targetLevel: 3 }, { competencyId: nowcast.id, targetLevel: 2 }] },
    },
  });
  const trainee = await session('TRAINEE');
  await prisma.enrollment.create({ data: { userId: trainee.user.id, courseId: course.id } });

  const q = (text: string, competencyId: string, correctIndex: number) => ({
    text,
    competencyId,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex,
    explanation: `Because of ${text}`,
  });
  const created = await request(app)
    .post(`/api/courses/${course.id}/assessments`)
    .set(auth(trainer.token))
    .send({
      title: 'Radar quiz',
      deadline: inAWeek(),
      passPercent: 60,
      questions: [q('Q1 radar', radar.id, 0), q('Q2 radar', radar.id, 1), q('Q3 radar', radar.id, 2), q('Q4 nowcast', nowcast.id, 0), q('Q5 nowcast', nowcast.id, 1)],
      ...extra,
    });
  expect(created.status).toBe(201);
  const id = created.body.assessment.id as string;
  await request(app).post(`/api/assessments/${id}/publish`).set(auth(trainer.token));
  return { radar, nowcast, other, trainer, trainee, course, id };
}

// Maps question text -> id, using the trainer's view
async function questionIds(trainerToken: string, id: string) {
  const res = await request(app).get(`/api/assessments/${id}`).set(auth(trainerToken));
  return Object.fromEntries(res.body.assessment.questions.map((q: { text: string; id: string }) => [q.text.slice(0, 2), q.id])) as Record<string, string>;
}

describe('building an assessment', () => {
  it('questions must use competencies the course builds', async () => {
    const { other, trainer, course } = await setup();
    const res = await request(app)
      .post(`/api/courses/${course.id}/assessments`)
      .set(auth(trainer.token))
      .send({ title: 'Bad quiz', deadline: inAWeek(), questions: [{ text: 'Firewall question', competencyId: other.id, options: ['a', 'b'], correctIndex: 0 }] });
    expect(res.status).toBe(400);
  });

  it('validates options and the correct answer, and requires a future deadline', async () => {
    const { radar, trainer, course } = await setup();
    const base = { title: 'Quiz', deadline: inAWeek() };
    const post = (body: object) => request(app).post(`/api/courses/${course.id}/assessments`).set(auth(trainer.token)).send({ ...base, ...body });

    expect((await post({ questions: [{ text: 'One option only', competencyId: radar.id, options: ['a'], correctIndex: 0 }] })).status).toBe(400);
    expect((await post({ questions: [{ text: 'Index out of range', competencyId: radar.id, options: ['a', 'b'], correctIndex: 5 }] })).status).toBe(400);
    expect((await post({ questions: [{ text: 'Duplicate options', competencyId: radar.id, options: ['Yes', 'yes'], correctIndex: 0 }] })).status).toBe(400);
    expect((await post({ deadline: '2020-01-01', questions: [{ text: 'Old deadline', competencyId: radar.id, options: ['a', 'b'], correctIndex: 0 }] })).status).toBe(400);
  });

  it('another trainer cannot add assessments to the course', async () => {
    const { radar, course } = await setup();
    const other = await session('TRAINER');
    const res = await request(app)
      .post(`/api/courses/${course.id}/assessments`)
      .set(auth(other.token))
      .send({ title: 'Quiz', deadline: inAWeek(), questions: [{ text: 'Question one', competencyId: radar.id, options: ['a', 'b'], correctIndex: 0 }] });
    expect(res.status).toBe(403);
  });
});

describe('correct answers never reach the trainee before submission', () => {
  it('neither the assessment view nor the start response contains answers or explanations', async () => {
    const { trainee, id } = await setup();
    const view = await request(app).get(`/api/assessments/${id}`).set(auth(trainee.token));
    const started = await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));

    expect(started.status).toBe(200);
    expect(started.body.questions).toHaveLength(5);
    for (const body of [view.body, started.body]) {
      const json = JSON.stringify(body);
      expect(json).not.toMatch(/correctOptionId|correctIndex|explanation/);
      expect(json).not.toMatch(/Because of/);
    }
  });

  it('only enrolled trainees can see or start it; drafts are hidden', async () => {
    const { trainer, trainee, course, radar, id } = await setup();
    const stranger = await session('TRAINEE');
    expect((await request(app).get(`/api/assessments/${id}`).set(auth(stranger.token))).status).toBe(403);
    expect((await request(app).post(`/api/assessments/${id}/start`).set(auth(stranger.token))).status).toBe(403);

    // A new assessment stays a draft until published: even enrolled trainees cannot see it
    const draft = await request(app)
      .post(`/api/courses/${course.id}/assessments`)
      .set(auth(trainer.token))
      .send({ title: 'Draft quiz', deadline: inAWeek(), questions: [{ text: 'Question one', competencyId: radar.id, options: ['a', 'b'], correctIndex: 0 }] });
    expect((await request(app).get(`/api/assessments/${draft.body.assessment.id}`).set(auth(trainee.token))).status).toBe(404);
  });
});

describe('scoring and the per-competency breakdown', () => {
  it('scores on the server and reports strong/weak competencies', async () => {
    const { trainer, trainee, id } = await setup();
    const ids = await questionIds(trainer.token, id);
    await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));

    // radar: 3/3 correct; nowcast: 0/2 (one wrong, one blank)
    const res = await request(app)
      .post(`/api/assessments/${id}/submit`)
      .set(auth(trainee.token))
      .send({ answers: { [ids.Q1!]: 'a', [ids.Q2!]: 'b', [ids.Q3!]: 'c', [ids.Q4!]: 'd' } });

    expect(res.status).toBe(200);
    const r = res.body.result;
    expect(r).toMatchObject({ score: 3, maxScore: 5, percent: 60, passed: true, strongIn: ['Radar Meteorology'], weakIn: ['Nowcasting'] });
    expect(r.competencies.map((c: { competencyName: string; correct: number; questions: number; percent: number }) => [c.competencyName, c.correct, c.questions, c.percent])).toEqual([
      ['Radar Meteorology', 3, 3, 100],
      ['Nowcasting', 0, 2, 0],
    ]);
    // After submitting, the review shows the correct answers and explanations
    const q4 = r.questions.find((q: { text: string }) => q.text === 'Q4 nowcast');
    expect(q4).toMatchObject({ selectedOptionId: 'd', correctOptionId: 'a', correct: false, explanation: 'Because of Q4 nowcast' });
  });

  it('updates the trainee skill levels using the agreed rule', async () => {
    const { radar, nowcast, trainer, trainee, id } = await setup();
    await prisma.userCompetency.create({ data: { userId: trainee.user.id, competencyId: radar.id, level: 1, source: 'SELF_ASSESSED' } });
    await prisma.userCompetency.create({ data: { userId: trainee.user.id, competencyId: nowcast.id, level: 3, source: 'ADMIN_ASSIGNED' } });
    const ids = await questionIds(trainer.token, id);
    await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));
    const res = await request(app)
      .post(`/api/assessments/${id}/submit`)
      .set(auth(trainee.token))
      .send({ answers: { [ids.Q1!]: 'a', [ids.Q2!]: 'b', [ids.Q3!]: 'c' } });

    const levels = await prisma.userCompetency.findMany({ where: { userId: trainee.user.id }, include: { competency: true } });
    const byName = Object.fromEntries(levels.map((l) => [l.competency.name, [l.level, l.source]]));
    expect(byName['Radar Meteorology']).toEqual([3, 'ASSESSMENT']); // 100% -> level 3, replaces self-assessed 1
    expect(byName.Nowcasting).toEqual([3, 'ADMIN_ASSIGNED']); // 0% would be level 1, but an admin level is never lowered
    const nowcastResult = res.body.result.competencies.find((c: { competencyName: string }) => c.competencyName === 'Nowcasting');
    expect(nowcastResult.level.reason).toMatch(/never lowered/);
  });
});

describe('single attempt', () => {
  it('a trainee cannot submit twice, and starting again resumes the same attempt', async () => {
    const { trainee, id } = await setup();
    const first = await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));
    const again = await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));
    expect(again.body.startedAt).toBe(first.body.startedAt);

    expect((await request(app).post(`/api/assessments/${id}/submit`).set(auth(trainee.token)).send({ answers: {} })).status).toBe(200);
    expect((await request(app).post(`/api/assessments/${id}/submit`).set(auth(trainee.token)).send({ answers: {} })).status).toBe(409);
    expect((await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token))).status).toBe(409);
    expect(await prisma.assessmentAttempt.count()).toBe(1);
  });

  it('two simultaneous submissions only count once', async () => {
    const { trainee, id } = await setup();
    await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));
    const results = await Promise.all([
      request(app).post(`/api/assessments/${id}/submit`).set(auth(trainee.token)).send({ answers: {} }),
      request(app).post(`/api/assessments/${id}/submit`).set(auth(trainee.token)).send({ answers: {} }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('must start before submitting', async () => {
    const { trainee, id } = await setup();
    expect((await request(app).post(`/api/assessments/${id}/submit`).set(auth(trainee.token)).send({ answers: {} })).status).toBe(400);
  });

  it('the questionnaire is locked once a trainee has started', async () => {
    const { radar, trainer, trainee, id } = await setup();
    await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));
    const res = await request(app)
      .put(`/api/assessments/${id}`)
      .set(auth(trainer.token))
      .send({ title: 'Changed', deadline: inAWeek(), questions: [{ text: 'New question', competencyId: radar.id, options: ['a', 'b'], correctIndex: 0 }] });
    expect(res.status).toBe(409);
  });
});

describe('deadline enforcement', () => {
  it('cannot start after the deadline', async () => {
    const { trainee, id } = await setup();
    await prisma.assessment.update({ where: { id }, data: { deadline: new Date(Date.now() - 60_000) } });
    const res = await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEADLINE_PASSED');
  });

  it('cannot submit after the deadline, but a few seconds of network delay are forgiven', async () => {
    const { trainee, id } = await setup();
    await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));

    await prisma.assessment.update({ where: { id }, data: { deadline: new Date(Date.now() - 10_000) } });
    const withinGrace = await request(app).post(`/api/assessments/${id}/submit`).set(auth(trainee.token)).send({ answers: {} });
    expect(withinGrace.status).toBe(200);
  });

  it('rejects a submission well after the deadline', async () => {
    const { trainee, id } = await setup();
    await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));
    await prisma.assessment.update({ where: { id }, data: { deadline: new Date(Date.now() - 5 * 60_000) } });
    const res = await request(app).post(`/api/assessments/${id}/submit`).set(auth(trainee.token)).send({ answers: {} });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEADLINE_PASSED');
  });

  it('enforces the time limit from when the attempt started', async () => {
    const { trainee, id } = await setup({ durationMinutes: 10 });
    await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));
    await prisma.assessmentAttempt.updateMany({ data: { startedAt: new Date(Date.now() - 15 * 60_000) } });
    const res = await request(app).post(`/api/assessments/${id}/submit`).set(auth(trainee.token)).send({ answers: {} });
    expect(res.status).toBe(409);
  });
});

describe('trainee overview', () => {
  it('lists open assessments with their status', async () => {
    const { trainee, id } = await setup();
    const before = await request(app).get('/api/me/assessments').set(auth(trainee.token));
    expect(before.body.assessments[0]).toMatchObject({ id, status: 'NOT_STARTED' });
    await request(app).post(`/api/assessments/${id}/start`).set(auth(trainee.token));
    await request(app).post(`/api/assessments/${id}/submit`).set(auth(trainee.token)).send({ answers: {} });
    const after = await request(app).get('/api/me/assessments').set(auth(trainee.token));
    expect(after.body.assessments[0]).toMatchObject({ status: 'SUBMITTED' });
  });
});
