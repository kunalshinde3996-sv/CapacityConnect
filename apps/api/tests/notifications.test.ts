import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { testOutbox } from '../src/modules/notifications/mailer.js';
import { deadlineSweep } from '../src/modules/notifications/notifications.service.js';
import { app, auth, createAdmin, createUser, files, loginAs, resetDb } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  testOutbox.length = 0;
});
afterAll(() => prisma.$disconnect());

async function session(role: 'TRAINEE' | 'TRAINER') {
  const user = await createUser({ role });
  const { accessToken } = await loginAs(user.email);
  return { user, token: accessToken };
}

async function courseWithTrainer() {
  const radar = await prisma.competency.create({ data: { name: 'Radar Meteorology', category: 'DOMAIN', description: 'x' } });
  const trainer = await session('TRAINER');
  const course = await prisma.course.create({
    data: {
      title: 'DWR Basics',
      description: 'x',
      status: 'PUBLISHED',
      createdById: trainer.user.id,
      trainerId: trainer.user.id,
      competencies: { create: [{ competencyId: radar.id, targetLevel: 2 }] },
    },
  });
  return { radar, trainer, course };
}

const notificationsOf = (userId: string) => prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

describe('notification events (in-app + email)', () => {
  it('enrolment confirmed', async () => {
    const { course } = await courseWithTrainer();
    const trainee = await session('TRAINEE');
    await request(app).post(`/api/courses/${course.id}/enroll`).set(auth(trainee.token));

    const [n] = await notificationsOf(trainee.user.id);
    expect(n).toMatchObject({ type: 'ENROLMENT_CONFIRMED', title: 'Enrolled: DWR Basics', link: `/courses/${course.id}` });
    expect(testOutbox).toEqual([expect.objectContaining({ to: trainee.user.email, subject: 'Capacity Connect: Enrolled: DWR Basics' })]);
  });

  it('new assessment: only enrolled trainees, and only once even if re-published', async () => {
    const { radar, trainer, course } = await courseWithTrainer();
    const enrolled = await session('TRAINEE');
    const outsider = await session('TRAINEE');
    await prisma.enrollment.create({ data: { userId: enrolled.user.id, courseId: course.id } });

    const created = await request(app)
      .post(`/api/courses/${course.id}/assessments`)
      .set(auth(trainer.token))
      .send({ title: 'Radar quiz', deadline: new Date(Date.now() + 3 * 86_400_000).toISOString(), questions: [{ text: 'Question one', competencyId: radar.id, options: ['a', 'b'], correctIndex: 0 }] });
    const id = created.body.assessment.id;
    await request(app).post(`/api/assessments/${id}/publish`).set(auth(trainer.token));
    await request(app).post(`/api/assessments/${id}/unpublish`).set(auth(trainer.token));
    await request(app).post(`/api/assessments/${id}/publish`).set(auth(trainer.token));

    const mine = await notificationsOf(enrolled.user.id);
    expect(mine.filter((n) => n.type === 'NEW_ASSESSMENT')).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: 'New assessment: Radar quiz', link: `/assessments/${id}` });
    expect(await notificationsOf(outsider.user.id)).toEqual([]);
  });

  it('account approved and rejected (the rejected user only gets the email, since they cannot sign in)', async () => {
    const { token } = await createAdmin();
    const pending = await createUser({ status: 'PENDING' });
    const rejected = await createUser({ status: 'PENDING' });
    await request(app).post(`/api/users/${pending.id}/approve`).set(auth(token));
    await request(app).post(`/api/users/${rejected.id}/reject`).set(auth(token)).send({ reason: 'Not a MoES employee' });

    expect((await notificationsOf(pending.id))[0]).toMatchObject({ type: 'ACCOUNT_APPROVED' });
    const rejectionMail = testOutbox.find((m) => m.to === rejected.email)!;
    expect(rejectionMail.text).toMatch(/Not a MoES employee/);
  });

  it('verification result for a trainer claim and for a trainee certificate', async () => {
    const { radar } = await courseWithTrainer();
    const trainer = await session('TRAINER');
    const cert = await prisma.certificate.create({ data: { userId: trainer.user.id, title: 'WMO radar course', issuer: 'WMO' } });
    const claim = await prisma.trainerCompetency.create({
      data: { userId: trainer.user.id, competencyId: radar.id, level: 3, evidenceType: 'CERTIFICATE', certificateId: cert.id },
    });
    const trainee = await session('TRAINEE');
    const traineeCert = await request(app)
      .post('/api/me/certificates')
      .set(auth(trainee.token))
      .field('title', 'GIS basics')
      .field('issuer', 'IIRS')
      .attach('file', files.pdf, { filename: 'gis.pdf', contentType: 'application/pdf' });
    const { token } = await createAdmin();

    await request(app).post(`/api/verifications/claims/${claim.id}`).set(auth(token)).send({ decision: 'APPROVE' });
    await request(app)
      .post(`/api/verifications/certificates/${traineeCert.body.certificate.id}`)
      .set(auth(token))
      .send({ decision: 'REJECT', reason: 'The scan is unreadable' });

    expect((await notificationsOf(trainer.user.id))[0]).toMatchObject({ type: 'VERIFICATION_RESULT', title: 'Claim verified: Radar Meteorology' });
    const t = (await notificationsOf(trainee.user.id))[0]!;
    expect(t).toMatchObject({ type: 'VERIFICATION_RESULT', title: 'Not verified: GIS basics' });
    expect(t.body).toMatch(/The scan is unreadable/);
  });
});

describe('deadline within 24 hours', () => {
  async function setupDeadline(hoursFromNow: number) {
    const { trainer, course } = await courseWithTrainer();
    const [done, due] = [await session('TRAINEE'), await session('TRAINEE')];
    for (const t of [done, due]) await prisma.enrollment.create({ data: { userId: t.user.id, courseId: course.id } });
    const assessment = await prisma.assessment.create({
      data: { courseId: course.id, title: 'Radar quiz', deadline: new Date(Date.now() + hoursFromNow * 3_600_000), published: true, createdById: trainer.user.id },
    });
    await prisma.assessmentAttempt.create({ data: { assessmentId: assessment.id, userId: done.user.id, submittedAt: new Date() } });
    return { done, due, assessment };
  }

  it('reminds only trainees who have not submitted, and only once', async () => {
    const { done, due } = await setupDeadline(5);
    await deadlineSweep();
    await deadlineSweep(); // e.g. the timer and a trainee opening notifications at the same time

    const reminders = await prisma.notification.findMany({ where: { type: 'DEADLINE_SOON' } });
    expect(reminders.map((r) => r.userId)).toEqual([due.user.id]);
    expect(reminders[0]!.title).toBe('Due within 24 hours: Radar quiz');
    expect(await notificationsOf(done.user.id)).toEqual([]);
  });

  it('does nothing for deadlines more than 24 hours away', async () => {
    await setupDeadline(30);
    await deadlineSweep();
    expect(await prisma.notification.count()).toBe(0);
  });

  it('opening the notification list creates the reminder (the free host may have been asleep)', async () => {
    const { due } = await setupDeadline(3);
    const res = await request(app).get('/api/me/notifications').set(auth(due.token));
    expect(res.body.unread).toBe(1);
    expect(res.body.items[0]).toMatchObject({ type: 'DEADLINE_SOON' });
    expect(JSON.stringify(res.body)).not.toMatch(/dedupeKey/);
  });
});

describe('reading notifications', () => {
  it('counts unread, marks one or all as read, and nobody can touch another user’s', async () => {
    const trainee = await session('TRAINEE');
    const other = await session('TRAINEE');
    const [a] = await Promise.all([
      prisma.notification.create({ data: { userId: trainee.user.id, title: 'One', body: 'x' } }),
      prisma.notification.create({ data: { userId: trainee.user.id, title: 'Two', body: 'x' } }),
    ]);

    expect((await request(app).get('/api/me/notifications/unread-count').set(auth(trainee.token))).body.unread).toBe(2);
    expect((await request(app).post(`/api/me/notifications/${a!.id}/read`).set(auth(other.token))).status).toBe(404);
    expect((await request(app).post(`/api/me/notifications/${a!.id}/read`).set(auth(trainee.token))).status).toBe(204);
    expect((await request(app).get('/api/me/notifications/unread-count').set(auth(trainee.token))).body.unread).toBe(1);
    await request(app).post('/api/me/notifications/read-all').set(auth(trainee.token));
    expect((await request(app).get('/api/me/notifications/unread-count').set(auth(trainee.token))).body.unread).toBe(0);
  });

  it('requires sign-in', async () => {
    expect((await request(app).get('/api/me/notifications')).status).toBe(401);
  });
});

describe('announcements', () => {
  const body = { type: 'ACHIEVEMENT', title: 'IMD Pune wins award', body: 'The DWR team was recognised for its nowcasting work.', linkUrl: '/courses' };

  it('admin creates a draft, publishes it for the public homepage, then unpublishes it', async () => {
    const { token } = await createAdmin();
    const created = await request(app).post('/api/announcements').set(auth(token)).send(body);
    expect(created.status).toBe(201);
    const id = created.body.announcement.id;

    expect((await request(app).get('/api/announcements/public')).body.announcements).toEqual([]);
    await request(app).post(`/api/announcements/${id}/publish`).set(auth(token));
    const feed = await request(app).get('/api/announcements/public'); // no sign-in
    expect(feed.body.announcements).toEqual([expect.objectContaining({ title: 'IMD Pune wins award', type: 'ACHIEVEMENT' })]);

    await request(app).put(`/api/announcements/${id}`).set(auth(token)).send({ ...body, title: 'IMD Pune team award' });
    await request(app).post(`/api/announcements/${id}/unpublish`).set(auth(token));
    expect((await request(app).get('/api/announcements/public')).body.announcements).toEqual([]);
    expect(await prisma.auditLog.count({ where: { entityType: 'Announcement' } })).toBe(4);
  });

  it('rejects unsafe links such as javascript: and protocol-relative URLs', async () => {
    const { token } = await createAdmin();
    for (const linkUrl of ['javascript:alert(1)', '//evil.example', 'http://insecure.example']) {
      expect((await request(app).post('/api/announcements').set(auth(token)).send({ ...body, linkUrl })).status).toBe(400);
    }
    expect((await request(app).post('/api/announcements').set(auth(token)).send({ ...body, linkUrl: 'https://mausam.imd.gov.in' })).status).toBe(201);
  });

  it('only admins can manage announcements', async () => {
    const trainer = await session('TRAINER');
    expect((await request(app).post('/api/announcements').set(auth(trainer.token)).send(body)).status).toBe(403);
    expect((await request(app).get('/api/announcements').set(auth(trainer.token))).status).toBe(403);
  });
});
