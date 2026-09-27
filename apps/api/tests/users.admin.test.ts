import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, cookiePair, createAdmin, createUser, loginAs, PASSWORD, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('role checks on /api/users', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it.each(['TRAINEE', 'TRAINER'] as const)('returns 403 for a %s', async (role) => {
    const user = await createUser({ role });
    const { accessToken } = await loginAs(user.email);
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('applies to write routes too (a trainer cannot approve anyone)', async () => {
    const trainer = await createUser({ role: 'TRAINER' });
    const pending = await createUser({ status: 'PENDING' });
    const { accessToken } = await loginAs(trainer.email);
    const res = await request(app).post(`/api/users/${pending.id}/approve`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it('uses the role from the database, so a demoted admin loses access at once', async () => {
    const { admin, token } = await createAdmin();
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'TRAINEE' } });
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('approval flow', () => {
  it('lists pending users, approves one, and that user can then log in', async () => {
    const { token } = await createAdmin();
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ravi@incois.gov.in', password: PASSWORD, fullName: 'Ravi Kumar' });
    const userId = reg.body.user.id;

    const pending = await request(app).get('/api/users?status=PENDING').set('Authorization', `Bearer ${token}`);
    expect(pending.status).toBe(200);
    expect(pending.body.total).toBe(1);
    expect(pending.body.items[0].id).toBe(userId);

    const approve = await request(app).post(`/api/users/${userId}/approve`).set('Authorization', `Bearer ${token}`);
    expect(approve.status).toBe(200);
    expect(approve.body.user.status).toBe('APPROVED');

    const login = await request(app).post('/api/auth/login').send({ email: 'ravi@incois.gov.in', password: PASSWORD });
    expect(login.status).toBe(200);

    const log = await prisma.auditLog.findFirst({ where: { action: 'USER_APPROVED', entityId: userId } });
    expect(log).not.toBeNull();
  });

  it('rejects a pending user with a reason, who then cannot log in', async () => {
    const { token } = await createAdmin();
    const user = await createUser({ status: 'PENDING' });

    const res = await request(app)
      .post(`/api/users/${user.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Not a MoES employee' });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('REJECTED');

    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    expect(login.body.error.code).toBe('ACCOUNT_REJECTED');

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'USER_REJECTED' } });
    expect(log.metadata).toMatchObject({ reason: 'Not a MoES employee' });
  });

  it('refuses to approve a user who is not pending (409)', async () => {
    const { token } = await createAdmin();
    const user = await createUser({ status: 'REJECTED' });
    const res = await request(app).post(`/api/users/${user.id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown user', async () => {
    const { token } = await createAdmin();
    const res = await request(app).post('/api/users/does-not-exist/approve').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('changing roles', () => {
  it('promotes a trainee to trainer, creates a trainer profile, and audits it', async () => {
    const { token } = await createAdmin();
    const user = await createUser();

    const res = await request(app)
      .patch(`/api/users/${user.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'TRAINER' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('TRAINER');

    expect(await prisma.trainerProfile.findUnique({ where: { userId: user.id } })).not.toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'ROLE_CHANGED', entityId: user.id } });
    expect(log.metadata).toEqual({ from: 'TRAINEE', to: 'TRAINER' });
  });

  it('rejects an invalid role', async () => {
    const { token } = await createAdmin();
    const user = await createUser();
    const res = await request(app)
      .patch(`/api/users/${user.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'SUPERUSER' });
    expect(res.status).toBe(400);
  });

  it('does not let an admin change their own role', async () => {
    const { admin, token } = await createAdmin();
    const res = await request(app)
      .patch(`/api/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'TRAINEE' });
    expect(res.status).toBe(400);
  });
});

describe('disabling instead of deleting', () => {
  it('disables a user: logs them out everywhere and blocks login, but keeps their data', async () => {
    const { token } = await createAdmin();
    const user = await createUser();
    const { cookie } = await loginAs(user.email);

    const res = await request(app)
      .post(`/api/users/${user.id}/disable`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Left the organisation' });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('DISABLED');

    const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(cookie));
    expect(refresh.status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED');

    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it('re-enables a disabled user', async () => {
    const { token } = await createAdmin();
    const user = await createUser({ status: 'DISABLED' });
    const res = await request(app).post(`/api/users/${user.id}/enable`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('APPROVED');
  });

  it('does not let an admin disable themselves', async () => {
    const { admin, token } = await createAdmin();
    const res = await request(app).post(`/api/users/${admin.id}/disable`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('has no delete endpoint', async () => {
    const { token } = await createAdmin();
    const user = await createUser();
    const res = await request(app).delete(`/api/users/${user.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });
});
