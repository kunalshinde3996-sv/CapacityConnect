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

async function setup() {
  const radar = await prisma.competency.create({ data: { name: 'Radar Meteorology', category: 'DOMAIN', description: 'x' } });
  const subject = await prisma.subject.create({ data: { name: 'DWR Operations', description: 'x' } });
  return { radar, subject };
}

// A published course with one module, created through the API by a trainer.
async function publishedCourse(token: string, radarId: string, extra: Record<string, unknown> = {}) {
  const created = await request(app)
    .post('/api/courses')
    .set(auth(token))
    .send({ title: 'DWR Basics', description: 'Operating Doppler weather radars', competencies: [{ competencyId: radarId, targetLevel: 2 }], ...extra });
  expect(created.status).toBe(201);
  const id = created.body.course.id as string;
  await request(app).post(`/api/courses/${id}/modules`).set(auth(token)).send({ title: 'How radar works' });
  const pub = await request(app).post(`/api/courses/${id}/publish`).set(auth(token));
  expect(pub.status).toBe(200);
  return id;
}

describe('creating courses', () => {
  it('a trainer creates a course, becomes its trainer, and must add a module + competency before publishing', async () => {
    const { radar, subject } = await setup();
    const trainer = await session('TRAINER');

    const created = await request(app)
      .post('/api/courses')
      .set(auth(trainer.token))
      .send({ title: 'DWR Basics', description: 'Operating Doppler weather radars', subjectId: subject.id });
    expect(created.status).toBe(201);
    expect(created.body.course).toMatchObject({ status: 'DRAFT', trainerId: trainer.user.id, subjectId: subject.id });
    const id = created.body.course.id;

    const tooEarly = await request(app).post(`/api/courses/${id}/publish`).set(auth(trainer.token));
    expect(tooEarly.status).toBe(400);

    await request(app).patch(`/api/courses/${id}`).set(auth(trainer.token)).send({ competencies: [{ competencyId: radar.id, targetLevel: 3 }] });
    await request(app).post(`/api/courses/${id}/modules`).set(auth(trainer.token)).send({ title: 'Module 1' });
    const ok = await request(app).post(`/api/courses/${id}/publish`).set(auth(trainer.token));
    expect(ok.status).toBe(200);
    expect(ok.body.course.status).toBe('PUBLISHED');
  });

  it('reorders modules', async () => {
    const { radar } = await setup();
    const trainer = await session('TRAINER');
    const id = await publishedCourse(trainer.token, radar.id);
    const second = await request(app).post(`/api/courses/${id}/modules`).set(auth(trainer.token)).send({ title: 'Reading products' });

    const moved = await request(app)
      .post(`/api/courses/${id}/modules/${second.body.module.id}/move`)
      .set(auth(trainer.token))
      .send({ direction: 'UP' });
    expect(moved.body.modules.map((m: { title: string }) => m.title)).toEqual(['Reading products', 'How radar works']);
  });

  it('another trainer cannot edit it, and trainees cannot create courses', async () => {
    const { radar } = await setup();
    const owner = await session('TRAINER');
    const id = await publishedCourse(owner.token, radar.id);

    const other = await session('TRAINER');
    const edit = await request(app).patch(`/api/courses/${id}`).set(auth(other.token)).send({ title: 'Hijacked course' });
    expect(edit.status).toBe(403);

    const trainee = await session('TRAINEE');
    const create = await request(app).post('/api/courses').set(auth(trainee.token)).send({ title: 'x', description: 'y' });
    expect(create.status).toBe(403);
  });

  it('rejects unknown competencies and end dates before start dates', async () => {
    await setup();
    const trainer = await session('TRAINER');
    const bad = await request(app)
      .post('/api/courses')
      .set(auth(trainer.token))
      .send({ title: 'DWR Basics', description: 'Operating Doppler weather radars', competencies: [{ competencyId: 'nope', targetLevel: 2 }] });
    expect(bad.status).toBe(400);
    const dates = await request(app)
      .post('/api/courses')
      .set(auth(trainer.token))
      .send({ title: 'DWR Basics', description: 'Operating Doppler weather radars', startDate: '2026-10-10', endDate: '2026-10-01' });
    expect(dates.status).toBe(400);
  });
});

describe('browsing', () => {
  it('trainees only see published courses; drafts are hidden (404)', async () => {
    const { radar } = await setup();
    const trainer = await session('TRAINER');
    const published = await publishedCourse(trainer.token, radar.id);
    const draft = await request(app).post('/api/courses').set(auth(trainer.token)).send({ title: 'Secret draft', description: 'Not ready yet' });

    const trainee = await session('TRAINEE');
    const list = await request(app).get('/api/courses').set(auth(trainee.token));
    expect(list.body.courses.map((c: { id: string }) => c.id)).toEqual([published]);
    const hidden = await request(app).get(`/api/courses/${draft.body.course.id}`).set(auth(trainee.token));
    expect(hidden.status).toBe(404);

    const mine = await request(app).get('/api/courses?mine=true').set(auth(trainer.token));
    expect(mine.body.courses).toHaveLength(2);
  });

  it('filters by competency and searches by text', async () => {
    const { radar } = await setup();
    const cyber = await prisma.competency.create({ data: { name: 'Network Security', category: 'FUNCTIONAL', description: 'x' } });
    const trainer = await session('TRAINER');
    await publishedCourse(trainer.token, radar.id);
    await publishedCourse(trainer.token, cyber.id, { title: 'Cyber hygiene', description: 'Protecting observing networks' });

    const trainee = await session('TRAINEE');
    const byCompetency = await request(app).get(`/api/courses?competencyId=${cyber.id}`).set(auth(trainee.token));
    expect(byCompetency.body.courses.map((c: { title: string }) => c.title)).toEqual(['Cyber hygiene']);
    const bySearch = await request(app).get('/api/courses?q=doppler').set(auth(trainee.token));
    expect(bySearch.body.courses.map((c: { title: string }) => c.title)).toEqual(['DWR Basics']);
  });
});

describe('enrolment', () => {
  it('enrols once, shows up in "my courses", and rejects a second enrolment', async () => {
    const { radar } = await setup();
    const trainer = await session('TRAINER');
    const id = await publishedCourse(trainer.token, radar.id);
    const trainee = await session('TRAINEE');

    const first = await request(app).post(`/api/courses/${id}/enroll`).set(auth(trainee.token));
    expect(first.status).toBe(201);
    const second = await request(app).post(`/api/courses/${id}/enroll`).set(auth(trainee.token));
    expect(second.status).toBe(409);

    const mine = await request(app).get('/api/me/courses').set(auth(trainee.token));
    expect(mine.body.enrollments).toHaveLength(1);
    expect(mine.body.enrollments[0].course.id).toBe(id);

    const detail = await request(app).get(`/api/courses/${id}`).set(auth(trainee.token));
    expect(detail.body.course.myEnrollment.status).toBe('ENROLLED');
  });

  it('respects capacity, even when trainees enrol at the same moment', async () => {
    const { radar } = await setup();
    const trainer = await session('TRAINER');
    const id = await publishedCourse(trainer.token, radar.id, { capacity: 1 });
    const a = await session('TRAINEE');
    const b = await session('TRAINEE');

    const results = await Promise.all([
      request(app).post(`/api/courses/${id}/enroll`).set(auth(a.token)),
      request(app).post(`/api/courses/${id}/enroll`).set(auth(b.token)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.enrollment.count({ where: { courseId: id } })).toBe(1);
  });

  it('cannot enrol in a draft or ended course; trainers cannot enrol', async () => {
    const { radar } = await setup();
    const trainer = await session('TRAINER');
    const draft = await request(app).post('/api/courses').set(auth(trainer.token)).send({ title: 'Draft course', description: 'Not ready yet' });
    const ended = await publishedCourse(trainer.token, radar.id, { startDate: '2024-01-01', endDate: '2024-02-01' });
    const trainee = await session('TRAINEE');

    expect((await request(app).post(`/api/courses/${draft.body.course.id}/enroll`).set(auth(trainee.token))).status).toBe(404);
    expect((await request(app).post(`/api/courses/${ended}/enroll`).set(auth(trainee.token))).status).toBe(409);
    expect((await request(app).post(`/api/courses/${ended}/enroll`).set(auth(trainer.token))).status).toBe(403);
  });

  it('a course with enrolments cannot go back to draft', async () => {
    const { radar } = await setup();
    const trainer = await session('TRAINER');
    const id = await publishedCourse(trainer.token, radar.id);
    const trainee = await session('TRAINEE');
    await request(app).post(`/api/courses/${id}/enroll`).set(auth(trainee.token));
    const res = await request(app).post(`/api/courses/${id}/unpublish`).set(auth(trainer.token));
    expect(res.status).toBe(409);
  });
});

describe('admin assigns a trainer', () => {
  it('assigns an approved trainer and audits it; refuses a trainee', async () => {
    const { radar } = await setup();
    const owner = await session('TRAINER');
    const id = await publishedCourse(owner.token, radar.id);
    const newTrainer = await createUser({ role: 'TRAINER' });
    const trainee = await createUser({ role: 'TRAINEE' });
    const { token } = await createAdmin();

    const bad = await request(app).put(`/api/courses/${id}/trainer`).set(auth(token)).send({ trainerId: trainee.id });
    expect(bad.status).toBe(400);
    const ok = await request(app).put(`/api/courses/${id}/trainer`).set(auth(token)).send({ trainerId: newTrainer.id });
    expect(ok.status).toBe(200);
    expect(ok.body.course.trainerId).toBe(newTrainer.id);
    expect(await prisma.auditLog.count({ where: { action: 'COURSE_TRAINER_ASSIGNED', entityId: id } })).toBe(1);

    const denied = await request(app).put(`/api/courses/${id}/trainer`).set(auth(owner.token)).send({ trainerId: owner.user.id });
    expect(denied.status).toBe(403);
  });
});
