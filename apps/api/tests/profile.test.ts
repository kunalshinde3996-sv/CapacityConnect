import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createFileLink } from '../src/modules/storage/fileLinks.js';
import { app, auth, createAdmin, createUser, files, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function traineeSession() {
  const user = await createUser({ role: 'TRAINEE' });
  await prisma.traineeProfile.create({ data: { userId: user.id } });
  const { accessToken } = await loginAs(user.email);
  return { user, token: accessToken };
}

const competency = (name: string) =>
  prisma.competency.create({ data: { name, category: 'DOMAIN', description: `${name} description` } });

function uploadCertificate(token: string, file: Buffer, filename: string, contentType = 'application/pdf') {
  return request(app)
    .post('/api/me/certificates')
    .set(auth(token))
    .field('title', 'Radar Training')
    .field('issuer', 'WMO')
    .attach('file', file, { filename, contentType });
}

describe('profile basics', () => {
  it('returns the profile sections and updates details and interests', async () => {
    const { token } = await traineeSession();
    const patch = await request(app)
      .patch('/api/me/profile')
      .set(auth(token))
      .send({ designation: 'Scientist-B', interests: ['monsoon', 'radar'] });
    expect(patch.status).toBe(200);
    expect(patch.body.profile).toMatchObject({ designation: 'Scientist-B', traineeProfile: { interests: ['monsoon', 'radar'] } });
    expect(patch.body.profile).toHaveProperty('qualifications');
    expect(patch.body.profile).toHaveProperty('certificates');
    expect(JSON.stringify(patch.body)).not.toMatch(/passwordHash|fileKey/);
  });

  it('adds and removes work experience, and validates dates', async () => {
    const { token } = await traineeSession();
    const bad = await request(app)
      .post('/api/me/experiences')
      .set(auth(token))
      .send({ organisation: 'IMD', title: 'SA', startDate: '2022-01-01', endDate: '2021-01-01' });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post('/api/me/experiences')
      .set(auth(token))
      .send({ organisation: 'IMD Pune', title: 'Scientific Assistant', startDate: '2021-06-01' });
    expect(ok.status).toBe(201);
    const del = await request(app).delete(`/api/me/experiences/${ok.body.experience.id}`).set(auth(token));
    expect(del.status).toBe(204);
  });
});

describe('skills picked from the competency framework', () => {
  it('saves self-assessed levels for existing competencies only', async () => {
    const { user, token } = await traineeSession();
    const radar = await competency('Radar Meteorology');

    const unknown = await request(app).put('/api/me/skills').set(auth(token)).send({ skills: [{ competencyId: 'nope', level: 2 }] });
    expect(unknown.status).toBe(400);

    const ok = await request(app).put('/api/me/skills').set(auth(token)).send({ skills: [{ competencyId: radar.id, level: 2 }] });
    expect(ok.status).toBe(200);
    const saved = await prisma.userCompetency.findUniqueOrThrow({ where: { userId_competencyId: { userId: user.id, competencyId: radar.id } } });
    expect(saved).toMatchObject({ level: 2, source: 'SELF_ASSESSED' });
  });

  it('never overwrites a level measured by an assessment', async () => {
    const { user, token } = await traineeSession();
    const radar = await competency('Radar Meteorology');
    await prisma.userCompetency.create({ data: { userId: user.id, competencyId: radar.id, level: 1, source: 'ASSESSMENT' } });

    await request(app).put('/api/me/skills').set(auth(token)).send({ skills: [{ competencyId: radar.id, level: 4 }] });
    const row = await prisma.userCompetency.findFirstOrThrow({ where: { userId: user.id } });
    expect(row).toMatchObject({ level: 1, source: 'ASSESSMENT' });
  });

  it('is for trainees only', async () => {
    const trainer = await createUser({ role: 'TRAINER' });
    const { accessToken } = await loginAs(trainer.email);
    const res = await request(app).put('/api/me/skills').set(auth(accessToken)).send({ skills: [] });
    expect(res.status).toBe(403);
  });
});

describe('certificate upload', () => {
  it('stores a real PDF as PENDING verification', async () => {
    const { user, token } = await traineeSession();
    const res = await uploadCertificate(token, files.pdf, 'radar.pdf');

    expect(res.status).toBe(201);
    expect(res.body.certificate).toMatchObject({ title: 'Radar Training', status: 'PENDING' });
    const stored = await prisma.certificate.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.fileKey).toMatch(/^certificates\/\d{4}\/[0-9a-f-]{36}\.pdf$/); // our key, not the user's file name
  });

  it('rejects a program renamed to .pdf (content check)', async () => {
    const { token } = await traineeSession();
    const res = await uploadCertificate(token, files.fakePdf, 'certificate.pdf');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects a type that is not allowed (extension check)', async () => {
    const { token } = await traineeSession();
    const res = await uploadCertificate(token, Buffer.from('hello'), 'notes.txt', 'text/plain');
    expect(res.status).toBe(415);
  });

  it('rejects files over the size limit (1 MB in tests)', async () => {
    const { token } = await traineeSession();
    const big = Buffer.concat([files.pdf, Buffer.alloc(1024 * 1024 + 10)]);
    const res = await uploadCertificate(token, big, 'big.pdf');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('requires a file', async () => {
    const { token } = await traineeSession();
    const res = await request(app).post('/api/me/certificates').set(auth(token)).field('title', 'x').field('issuer', 'y');
    expect(res.status).toBe(400);
  });

  it('cannot delete a verified certificate', async () => {
    const { token } = await traineeSession();
    const res = await uploadCertificate(token, files.pdf, 'radar.pdf');
    await prisma.certificate.update({ where: { id: res.body.certificate.id }, data: { status: 'VERIFIED' } });
    const del = await request(app).delete(`/api/me/certificates/${res.body.certificate.id}`).set(auth(token));
    expect(del.status).toBe(409);
  });
});

describe('serving files only to authorised users', () => {
  it('gives the owner a signed link that downloads the file', async () => {
    const { token } = await traineeSession();
    const { body } = await uploadCertificate(token, files.pdf, 'radar.pdf');

    const link = await request(app).get(`/api/documents/certificates/${body.certificate.id}/file`).set(auth(token));
    expect(link.status).toBe(200);
    const file = await request(app).get(link.body.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.body.toString()).toBe(files.pdf.toString());
  });

  it('supports Range requests (needed for video seeking)', async () => {
    const { token } = await traineeSession();
    const { body } = await uploadCertificate(token, files.pdf, 'radar.pdf');
    const link = await request(app).get(`/api/documents/certificates/${body.certificate.id}/file`).set(auth(token));
    const part = await request(app).get(link.body.url).set('Range', 'bytes=0-4');
    expect(part.status).toBe(206);
    expect(part.body.toString()).toBe('%PDF-');
  });

  it('refuses links to other users, but allows admins', async () => {
    const { token } = await traineeSession();
    const { body } = await uploadCertificate(token, files.pdf, 'radar.pdf');
    const other = await traineeSession();
    const { token: adminToken } = await createAdmin();

    const denied = await request(app).get(`/api/documents/certificates/${body.certificate.id}/file`).set(auth(other.token));
    expect(denied.status).toBe(404);
    const allowed = await request(app).get(`/api/documents/certificates/${body.certificate.id}/file`).set(auth(adminToken));
    expect(allowed.status).toBe(200);
  });

  it('rejects a tampered or expired link, and a request with no link', async () => {
    const { token } = await traineeSession();
    const { body } = await uploadCertificate(token, files.pdf, 'radar.pdf');
    const link = await request(app).get(`/api/documents/certificates/${body.certificate.id}/file`).set(auth(token));

    const tampered = await request(app).get(link.body.url.replace(/s=[^&]+/, 's=forged'));
    expect(tampered.status).toBe(403);

    const key = new URL(link.body.url, 'http://x').searchParams.get('k')!;
    const expired = await request(app).get(createFileLink(key, 'radar.pdf', -1).url);
    expect(expired.status).toBe(403);

    expect((await request(app).get('/api/files')).status).toBe(403);
  });
});

describe('applying to become a trainer', () => {
  const motivation = 'I have run the DWR at Mumbai for five years and trained new staff.';

  it('lets a trainee apply once, and an admin approve (role becomes TRAINER)', async () => {
    const { user, token } = await traineeSession();
    const first = await request(app).post('/api/me/trainer-application').set(auth(token)).send({ motivation });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/me/trainer-application').set(auth(token)).send({ motivation });
    expect(second.status).toBe(409);

    const { token: adminToken } = await createAdmin();
    const list = await request(app).get('/api/trainer-applications?status=PENDING').set(auth(adminToken));
    expect(list.body.applications).toHaveLength(1);

    const review = await request(app)
      .post(`/api/trainer-applications/${first.body.application.id}/review`)
      .set(auth(adminToken))
      .send({ decision: 'APPROVE' });
    expect(review.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { trainerProfile: true } });
    expect(updated.role).toBe('TRAINER');
    expect(updated.trainerProfile).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: 'TRAINER_APPLICATION_APPROVED' } })).toBe(1);
  });

  it('needs a reason to reject, and a trainer cannot apply', async () => {
    const { token } = await traineeSession();
    const { body } = await request(app).post('/api/me/trainer-application').set(auth(token)).send({ motivation });
    const { token: adminToken } = await createAdmin();

    const noReason = await request(app)
      .post(`/api/trainer-applications/${body.application.id}/review`)
      .set(auth(adminToken))
      .send({ decision: 'REJECT' });
    expect(noReason.status).toBe(400);

    const trainer = await createUser({ role: 'TRAINER' });
    const { accessToken } = await loginAs(trainer.email);
    const res = await request(app).post('/api/me/trainer-application').set(auth(accessToken)).send({ motivation });
    expect(res.status).toBe(403);
  });
});
