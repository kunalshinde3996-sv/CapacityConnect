import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, auth, createAdmin, createUser, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// One institute, one course with a published assessment, 3 enrolled trainees:
// Asha submitted, Ben only started, Chen did nothing. A 4th trainee is not enrolled.
async function setup() {
  const inst = await prisma.institute.create({ data: { code: 'IMD-PUNE', name: 'IMD Pune', city: 'Pune' } });
  const trainer = await createUser({ role: 'TRAINER' });
  const { accessToken: trainerToken } = await loginAs(trainer.email);
  const course = await prisma.course.create({ data: { title: 'DWR Basics', description: 'x', status: 'PUBLISHED', createdById: trainer.id, trainerId: trainer.id } });
  const assessment = await prisma.assessment.create({
    data: { courseId: course.id, title: 'Quiz', deadline: new Date(Date.now() + 86_400_000), published: true, createdById: trainer.id },
  });

  const [asha, ben, chen] = await Promise.all([createUser(), createUser(), createUser()]);
  await createUser(); // approved trainee, not enrolled
  for (const u of [asha, ben, chen]) {
    await prisma.user.update({ where: { id: u.id }, data: { instituteId: inst.id } });
    await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id } });
  }
  await prisma.assessmentAttempt.create({ data: { assessmentId: assessment.id, userId: asha.id, submittedAt: new Date(), score: 3, maxScore: 4 } });
  await prisma.assessmentAttempt.create({ data: { assessmentId: assessment.id, userId: ben.id } });
  return { trainer, trainerToken, course, asha, ben, chen };
}

describe('marking a course completed', () => {
  it('the course trainer completes an enrolment, which issues a verified course certificate', async () => {
    const { trainerToken, course, asha } = await setup();
    const res = await request(app).post(`/api/courses/${course.id}/enrollments/${asha.id}/complete`).set(auth(trainerToken));

    expect(res.status).toBe(200);
    expect(res.body.enrollment).toMatchObject({ status: 'COMPLETED' });
    const cert = await prisma.certificate.findFirstOrThrow({ where: { userId: asha.id } });
    expect(cert).toMatchObject({ courseId: course.id, status: 'VERIFIED', title: 'Course completion: DWR Basics' });
    expect(await prisma.auditLog.count({ where: { action: 'COURSE_COMPLETED' } })).toBe(1);

    const again = await request(app).post(`/api/courses/${course.id}/enrollments/${asha.id}/complete`).set(auth(trainerToken));
    expect(again.status).toBe(409);
    expect(await prisma.certificate.count({ where: { userId: asha.id } })).toBe(1);
  });

  it('only the course trainer or an admin can do it', async () => {
    const { course, asha } = await setup();
    const other = await createUser({ role: 'TRAINER' });
    const { accessToken } = await loginAs(other.email);
    expect((await request(app).post(`/api/courses/${course.id}/enrollments/${asha.id}/complete`).set(auth(accessToken))).status).toBe(403);
    const trainee = await loginAs(asha.email);
    expect((await request(app).post(`/api/courses/${course.id}/enrollments/${asha.id}/complete`).set(auth(trainee.accessToken))).status).toBe(403);
  });

  it('returns 404 for someone who is not enrolled', async () => {
    const { trainerToken, course } = await setup();
    const stranger = await createUser();
    expect((await request(app).post(`/api/courses/${course.id}/enrollments/${stranger.id}/complete`).set(auth(trainerToken))).status).toBe(404);
  });
});

describe('GET /api/dashboard', () => {
  it('counts users, courses, enrolments, completions, certifications and attempts', async () => {
    const { trainerToken, course, asha } = await setup();
    await request(app).post(`/api/courses/${course.id}/enrollments/${asha.id}/complete`).set(auth(trainerToken));
    const { token } = await createAdmin();

    const res = await request(app).get('/api/dashboard').set(auth(token));
    expect(res.status).toBe(200);
    const d = res.body;
    expect(d.users.byRole).toEqual([
      { role: 'TRAINEE', count: 4 },
      { role: 'TRAINER', count: 1 },
      { role: 'ADMIN', count: 1 },
    ]);
    expect(d.courses).toMatchObject({ published: 1, draft: 0 });
    expect(d.enrolments).toEqual({ total: 3, completed: 1 });
    expect(d.certifications).toMatchObject({ verified: 1, fromCourses: 1 });
    expect(d.attempts).toEqual({ submitted: 1, inProgress: 1 });
    expect(d.charts.enrolmentsByCourse).toEqual([{ course: 'DWR Basics', enrolments: 3 }]);
    expect(d.charts.submissionsPerWeek).toHaveLength(8);
    expect(d.charts.submissionsPerWeek.at(-1).submissions).toBe(1);
  });

  it('participation = trainees who submitted at least once / trainees with an assessment to do', async () => {
    await setup();
    const { token } = await createAdmin();
    const res = await request(app).get('/api/dashboard').set(auth(token));
    // 3 enrolled in a course with an assessment; only Asha submitted (Ben started, Chen nothing)
    expect(res.body.participation).toMatchObject({ participants: 1, eligible: 3, rate: 33.3 });
    expect(res.body.participation.byInstitute).toEqual([{ institute: 'IMD-PUNE', name: 'IMD Pune', participants: 1, eligible: 3, rate: 33.3 }]);
  });

  it('is admin only', async () => {
    const { trainerToken } = await setup();
    expect((await request(app).get('/api/dashboard').set(auth(trainerToken))).status).toBe(403);
  });
});
