import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { RateLimiter } from '../src/lib/rateLimit.js';
import { describeRoutes } from '../src/lib/routeTable.js';
import { app, auth, createAdmin, createUser, getSetCookie, loginAs, PASSWORD, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const routes = describeRoutes(ROUTES);
const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`;

// The only routes that may be reached without signing in, and why.
const PUBLIC = new Set([
  'GET /api/health', // uptime checks
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/refresh', // uses the HttpOnly refresh cookie instead of a token
  'POST /api/auth/logout',
  'GET /api/files', // protected by a short-lived HMAC signature instead
  'GET /api/announcements/public', // homepage
]);

// Write routes that take no request body (the action is in the URL).
const NO_BODY = new Set([
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
  'POST /api/users/:id/approve',
  'POST /api/users/:id/enable',
  'POST /api/me/notifications/read-all',
  'POST /api/me/notifications/:id/read',
  'POST /api/announcements/:id/publish',
  'POST /api/announcements/:id/unpublish',
  'POST /api/courses/:id/publish',
  'POST /api/courses/:id/archive',
  'POST /api/courses/:id/unpublish',
  'POST /api/courses/:id/enroll',
  'POST /api/courses/:id/enrollments/:userId/complete',
  'POST /api/assessments/:id/publish',
  'POST /api/assessments/:id/unpublish',
  'POST /api/assessments/:id/start',
]);

// Admin-only areas: every route under these prefixes must be ADMIN only.
const ADMIN_ONLY = ['/api/users', '/api/verifications', '/api/trainer-applications', '/api/dashboard', '/api/audit-log', '/api/skill-gaps'];

describe('route audit (every route the app serves)', () => {
  it('finds the routes', () => {
    expect(routes.length).toBeGreaterThan(70);
  });

  it('every route requires sign-in unless it is on the public list', () => {
    const unexpectedPublic = routes.filter((r) => !r.auth && !PUBLIC.has(key(r))).map(key);
    expect(unexpectedPublic).toEqual([]);
  });

  it('every write route validates its body with zod, or takes no body', () => {
    const unvalidated = routes
      .filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method) && !r.validatesBody && !NO_BODY.has(key(r)))
      .map(key);
    expect(unvalidated).toEqual([]);
  });

  it('admin areas are admin only', () => {
    const leaks = routes.filter((r) => ADMIN_ONLY.some((p) => r.path.startsWith(p)) && JSON.stringify(r.roles) !== '["ADMIN"]').map(key);
    expect(leaks).toEqual([]);
  });

  it('really rejects unauthenticated requests with 401 (not just on paper)', async () => {
    const statuses: string[] = [];
    for (const r of routes.filter((x) => x.auth)) {
      const path = r.path.replace(/:[A-Za-z]+/g, 'some-id');
      const res = await request(app)[r.method.toLowerCase() as 'get'](path);
      if (res.status !== 401) statuses.push(`${key(r)} -> ${res.status}`);
    }
    expect(statuses).toEqual([]);
  });
});

describe('login rate limiting', () => {
  it('blocks an account after 10 failed logins, even with the right password, and says when to retry', async () => {
    const user = await createUser();
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' })).status).toBe(401);
    }
    const blocked = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    expect(blocked.body.error.message).toMatch(/Try again in 15 minutes/);

    // Other accounts are unaffected
    const other = await createUser();
    expect((await request(app).post('/api/auth/login').send({ email: other.email, password: PASSWORD })).status).toBe(200);
  });

  it('a successful login clears earlier failures', async () => {
    const user = await createUser();
    for (let i = 0; i < 9; i++) await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect((await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(200);
    for (let i = 0; i < 9; i++) await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect((await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(200);
  });

  it('limits login and registration attempts per IP address (100 per 15 minutes)', async () => {
    for (let i = 0; i < 100; i++) await request(app).post('/api/auth/register').send({});
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.test', password: 'x' });
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('the limiter window resets', () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.hit('k', 0)).toBeNull();
    expect(limiter.hit('k', 10)).toBeNull();
    expect(limiter.hit('k', 20)).toBe(1); // third hit in the window: wait ~1 s
    expect(limiter.hit('k', 1500)).toBeNull(); // new window
  });
});

describe('headers and cookies', () => {
  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toMatch(/max-age/);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('only allows the configured web origin (CORS)', async () => {
    const good = await request(app).options('/api/auth/login').set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'POST');
    expect(good.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(good.headers['access-control-allow-credentials']).toBe('true');
    const evil = await request(app).options('/api/auth/login').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('the refresh cookie is HttpOnly, SameSite=Lax and limited to /api/auth', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    const cookie = getSetCookie(res)[0]!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    // Secure is added in production (NODE_ENV=production); tests run over plain HTTP.
  });
});

describe('audit log', () => {
  it('records approvals and role changes, and admins can read and filter it', async () => {
    const { admin, token } = await createAdmin();
    const pending = await createUser({ status: 'PENDING' });
    await request(app).post(`/api/users/${pending.id}/approve`).set(auth(token));
    await request(app).patch(`/api/users/${pending.id}/role`).set(auth(token)).send({ role: 'TRAINER' });

    const all = await request(app).get('/api/audit-log').set(auth(token));
    expect(all.status).toBe(200);
    expect(all.body.actions.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['USER_APPROVED', 'ROLE_CHANGED']));

    const approvals = await request(app).get('/api/audit-log?action=USER_APPROVED').set(auth(token));
    expect(approvals.body.items).toHaveLength(1);
    expect(approvals.body.items[0]).toMatchObject({ entityId: pending.id, actor: { fullName: admin.fullName } });

    const trainer = await createUser({ role: 'TRAINER' });
    const { accessToken } = await loginAs(trainer.email);
    expect((await request(app).get('/api/audit-log').set(auth(accessToken))).status).toBe(403);
  });
});
