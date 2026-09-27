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

// A subject needing Public Risk Communication at level 3 (weight 1), and a trainer who
// only self-declares it at level 3 (fit 50%) but teaches a course tagged with it.
async function setup() {
  const comm = await prisma.competency.create({ data: { name: 'Public Risk Communication', category: 'BEHAVIOURAL', description: 'x' } });
  const subject = await prisma.subject.create({
    data: { name: 'Cyclone Warnings', description: 'x', requirements: { create: [{ competencyId: comm.id, minLevel: 3, weight: '1' }] } },
  });
  const trainer = await session('TRAINER');
  await prisma.trainerCompetency.create({ data: { userId: trainer.user.id, competencyId: comm.id, level: 3, evidenceType: 'SELF_DECLARED', evidenceNote: 'Media briefings' } });
  const course = await prisma.course.create({
    data: {
      title: 'Cyclone Warnings 101',
      description: 'x',
      status: 'PUBLISHED',
      createdById: trainer.user.id,
      trainerId: trainer.user.id,
      subjectId: subject.id,
      competencies: { create: [{ competencyId: comm.id, targetLevel: 3 }] },
    },
  });
  return { comm, subject, trainer, course };
}

async function enrolledTrainee(courseId: string) {
  const t = await session('TRAINEE');
  await prisma.enrollment.create({ data: { userId: t.user.id, courseId } });
  return t;
}

describe('giving feedback', () => {
  it('an enrolled trainee rates a course and can change the rating later', async () => {
    const { course } = await setup();
    const trainee = await enrolledTrainee(course.id);

    const first = await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(trainee.token)).send({ rating: 3, comment: 'Good start' });
    expect(first.status).toBe(200);
    await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(trainee.token)).send({ rating: 5, comment: 'Much better after module 2' });

    expect(await prisma.feedback.count()).toBe(1);
    const mine = await request(app).get(`/api/courses/${course.id}/feedback`).set(auth(trainee.token));
    expect(mine.body).toEqual({ mine: expect.objectContaining({ rating: 5, comment: 'Much better after module 2' }) });
  });

  it('is only possible after enrolling, and ratings are 1-5', async () => {
    const { course } = await setup();
    const outsider = await session('TRAINEE');
    expect((await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(outsider.token)).send({ rating: 5 })).status).toBe(403);

    const trainee = await enrolledTrainee(course.id);
    expect((await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(trainee.token)).send({ rating: 6 })).status).toBe(400);
    expect((await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(trainee.token)).send({ rating: 0 })).status).toBe(400);
  });
});

describe('the trainer view', () => {
  it('shows the average, distribution and anonymous comments', async () => {
    const { course, trainer } = await setup();
    for (const [rating, comment] of [[5, 'Clear examples'], [4, undefined], [3, 'Too fast']] as const) {
      const t = await enrolledTrainee(course.id);
      await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(t.token)).send({ rating, comment });
    }

    const res = await request(app).get(`/api/courses/${course.id}/feedback`).set(auth(trainer.token));
    expect(res.body).toMatchObject({ count: 3, average: 4, teachingEvidence: { counts: true, minRatings: 3, minAverage: 4 } });
    expect(res.body.distribution).toEqual([
      { stars: 5, count: 1 },
      { stars: 4, count: 1 },
      { stars: 3, count: 1 },
      { stars: 2, count: 0 },
      { stars: 1, count: 0 },
    ]);
    expect(res.body.comments.map((c: { comment: string }) => c.comment).sort()).toEqual(['Clear examples', 'Too fast']);
    // Anonymous: no user ids or names in the trainer's view
    expect(JSON.stringify(res.body)).not.toMatch(/userId|fullName|email/);
  });

  it('other trainers cannot see it (they only get their own, empty, feedback)', async () => {
    const { course } = await setup();
    const t = await enrolledTrainee(course.id);
    await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(t.token)).send({ rating: 5, comment: 'Great' });
    const other = await session('TRAINER');
    const res = await request(app).get(`/api/courses/${course.id}/feedback`).set(auth(other.token));
    expect(res.body).toEqual({ mine: null });
  });
});

describe('feedback as teaching evidence in trainer matching', () => {
  async function fit(subjectId: string, trainerId: string) {
    const { token } = await createAdmin();
    const res = await request(app).get(`/api/subjects/${subjectId}/trainer-matches`).set(auth(token));
    return res.body.matches.find((m: { trainer: { id: string } }) => m.trainer.id === trainerId);
  }

  it('3+ ratings averaging 4.0+ raise the trainer from self-declared (50%) to teaching trust (80%)', async () => {
    const { subject, trainer, course } = await setup();
    expect((await fit(subject.id, trainer.user.id)).fitPercent).toBe(50);

    for (const rating of [5, 4, 4]) {
      const t = await enrolledTrainee(course.id);
      await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(t.token)).send({ rating });
    }

    const after = await fit(subject.id, trainer.user.id);
    expect(after.fitPercent).toBe(80);
    expect(after.breakdown[0]).toMatchObject({ evidenceType: 'TEACHING', trust: 0.8 });
    expect(after.breakdown[0].evidenceNote).toBe('Teaching record: taught “Cyclone Warnings 101”, rated 4.3/5 by 3 trainees');
  });

  it('two ratings, or a low average, change nothing', async () => {
    const { subject, trainer, course } = await setup();
    for (const rating of [5, 5]) {
      const t = await enrolledTrainee(course.id);
      await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(t.token)).send({ rating });
    }
    expect((await fit(subject.id, trainer.user.id)).fitPercent).toBe(50);

    const t = await enrolledTrainee(course.id);
    await request(app).put(`/api/courses/${course.id}/feedback`).set(auth(t.token)).send({ rating: 1 }); // avg 3.67
    const res = await fit(subject.id, trainer.user.id);
    expect(res.fitPercent).toBe(50);
    expect(res.breakdown[0]).toMatchObject({ evidenceType: 'SELF_DECLARED', evidenceNote: 'Media briefings' });
  });
});
