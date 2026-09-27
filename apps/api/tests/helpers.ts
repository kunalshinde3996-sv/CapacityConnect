import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Role, UserStatus } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();
export const PASSWORD = 'Password@123';

// Empties every table (except Prisma's migration history) so each test starts clean.
export async function resetDb() {
  if (!process.env.DATABASE_URL?.includes('_test')) {
    throw new Error('Refusing to wipe a database whose name does not contain "_test"');
  }
  tables ??= (
    await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  ).map((t) => `"public"."${t.tablename}"`);

  // DELETE is much faster than TRUNCATE for tiny tables (~1s -> a few ms per test).
  // `session_replication_role = replica` switches off foreign-key checks for this
  // transaction only, so tables can be emptied in any order.
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`),
    ...tables.map((t) => prisma.$executeRawUnsafe(`DELETE FROM ${t}`)),
  ]);
}

let tables: string[] | undefined;

let counter = 0;

// Inserts a user directly (bypassing the API) with a known password.
export async function createUser(opts: { role?: Role; status?: UserStatus; email?: string } = {}) {
  counter += 1;
  return prisma.user.create({
    data: {
      email: opts.email ?? `user${counter}@moes.test`,
      passwordHash: await hashPassword(PASSWORD),
      fullName: `Test User ${counter}`,
      role: opts.role ?? 'TRAINEE',
      status: opts.status ?? 'APPROVED',
    },
  });
}

// Logs in through the real endpoint and returns the access token + refresh cookie.
export async function loginAs(email: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return { accessToken: res.body.accessToken as string, cookie: getSetCookie(res) };
}

export async function createAdmin() {
  const admin = await createUser({ role: 'ADMIN' });
  const { accessToken } = await loginAs(admin.email);
  return { admin, token: accessToken };
}

export function getSetCookie(res: request.Response): string[] {
  const header = res.headers['set-cookie'];
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

// "cc_refresh=abc; Path=/api/auth; HttpOnly" -> "cc_refresh=abc"
export function cookiePair(setCookie: string[]) {
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

// ── File fixtures for upload tests ─────────────────────────
// Just enough bytes to pass (or deliberately fail) the content checks.
export const files = {
  pdf: Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n'),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]),
  // A Windows program ("MZ" header) renamed to .pdf must be rejected
  fakePdf: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]),
};

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
