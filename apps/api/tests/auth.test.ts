import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, cookiePair, createUser, getSetCookie, loginAs, PASSWORD, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const newUser = { email: 'Asha.Rao@IMD.gov.in', password: PASSWORD, fullName: 'Asha Rao' };

describe('POST /api/auth/register', () => {
  it('creates a PENDING trainee and never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'asha.rao@imd.gov.in', role: 'TRAINEE', status: 'PENDING' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'asha.rao@imd.gov.in' }, include: { traineeProfile: true } });
    expect(stored.passwordHash).not.toBe(PASSWORD); // hashed, not plain text
    expect(stored.traineeProfile).not.toBeNull();
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(newUser);
    const res = await request(app).post('/api/auth/register').send({ ...newUser, email: 'asha.rao@imd.gov.in' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('validates the body with zod', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fieldErrors).toHaveProperty('email');
    expect(res.body.error.details.fieldErrors).toHaveProperty('password');
  });

  it('ignores an attempt to self-assign the ADMIN role', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser, role: 'ADMIN', status: 'APPROVED' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'TRAINEE', status: 'PENDING' });
  });
});

describe('POST /api/auth/login', () => {
  it('is blocked while the account is PENDING', async () => {
    await request(app).post('/api/auth/register').send(newUser);
    const res = await request(app).post('/api/auth/login').send({ email: newUser.email, password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_PENDING');
    expect(getSetCookie(res)).toHaveLength(0);
  });

  it('does not reveal the account status when the password is wrong', async () => {
    await request(app).post('/api/auth/register').send(newUser);
    const res = await request(app).post('/api/auth/login').send({ email: newUser.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives the same error for an unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@moes.test', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it.each([
    ['REJECTED', 'ACCOUNT_REJECTED'],
    ['DISABLED', 'ACCOUNT_DISABLED'],
  ] as const)('is blocked for %s accounts', async (status, code) => {
    const user = await createUser({ status });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(code);
  });

  it('returns an access token and sets an HttpOnly refresh cookie for APPROVED users', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toBeUndefined(); // only ever in the cookie
    const cookie = getSetCookie(res).join(';');
    expect(cookie).toMatch(/cc_refresh=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });
});

describe('GET /api/auth/me', () => {
  it('requires a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns the current user', async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(user.email);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it('stops working immediately once the account is disabled', async () => {
    const user = await createUser();
    const { accessToken } = await loginAs(user.email);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });
});

describe('refresh and logout', () => {
  it('rotates the refresh token: the new one works, the old one does not', async () => {
    const user = await createUser();
    const { cookie } = await loginAs(user.email);

    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(cookie));
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toEqual(expect.any(String));
    const rotated = getSetCookie(first);

    const second = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(rotated));
    expect(second.status).toBe(200);
  });

  it('treats reuse of an old refresh token as theft and revokes all sessions', async () => {
    const user = await createUser();
    const { cookie: original } = await loginAs(user.email);
    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(original));
    const current = getSetCookie(refreshed);

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(original));
    expect(reuse.status).toBe(401);

    // The legitimate latest token is now revoked too.
    const afterReuse = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(current));
    expect(afterReuse.status).toBe(401);
  });

  it('returns 401 without a cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_REFRESH_TOKEN');
  });

  it('logout revokes the refresh token and clears the cookie', async () => {
    const user = await createUser();
    const { cookie } = await loginAs(user.email);

    const out = await request(app).post('/api/auth/logout').set('Cookie', cookiePair(cookie));
    expect(out.status).toBe(204);
    expect(getSetCookie(out).join(';')).toMatch(/cc_refresh=;/);

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookiePair(cookie));
    expect(res.status).toBe(401);
  });
});
