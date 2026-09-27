import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, auth, createAdmin, createUser, files, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// One subject that needs a single competency (weight 1.0), so fit % = coverage x 100.
async function setup() {
  const radar = await prisma.competency.create({ data: { name: 'Radar Meteorology', category: 'DOMAIN', description: 'x' } });
  const subject = await prisma.subject.create({
    data: { name: 'DWR Operations', description: 'x', requirements: { create: [{ competencyId: radar.id, minLevel: 3, weight: '1' }] } },
  });
  const trainer = await createUser({ role: 'TRAINER' });
  const { accessToken: trainerToken } = await loginAs(trainer.email);
  const { token: adminToken } = await createAdmin();
  return { radar, subject, trainer, trainerToken, adminToken };
}

async function submitCertificateClaim(token: string, competencyId: string, level = 3) {
  const cert = await request(app)
    .post('/api/me/certificates')
    .set(auth(token))
    .field('title', 'Advanced Radar Meteorology')
    .field('issuer', 'WMO RTC')
    .attach('file', files.pdf, { filename: 'wmo.pdf', contentType: 'application/pdf' });
  const claim = await request(app)
    .put('/api/me/claims')
    .set(auth(token))
    .field('competencyId', competencyId)
    .field('level', String(level))
    .field('evidenceType', 'CERTIFICATE')
    .field('certificateId', cert.body.certificate.id);
  expect(claim.status).toBe(200);
  return { certificateId: cert.body.certificate.id as string, claimId: claim.body.claim.id as string };
}

async function fitPercent(adminToken: string, subjectId: string, trainerId: string) {
  const res = await request(app).get(`/api/subjects/${subjectId}/trainer-matches`).set(auth(adminToken));
  return res.body.matches.find((m: { trainer: { id: string } }) => m.trainer.id === trainerId).fitPercent as number;
}

describe('trainer claims', () => {
  it('require the backing document for CERTIFICATE evidence', async () => {
    const { radar, trainerToken } = await setup();
    const res = await request(app)
      .put('/api/me/claims')
      .set(auth(trainerToken))
      .field('competencyId', radar.id)
      .field('level', '3')
      .field('evidenceType', 'CERTIFICATE');
    expect(res.status).toBe(400);
  });

  it('cannot use another user\'s certificate', async () => {
    const { radar, trainerToken } = await setup();
    const other = await createUser({ role: 'TRAINER' });
    const cert = await prisma.certificate.create({ data: { userId: other.id, title: 'x', issuer: 'y' } });
    const res = await request(app)
      .put('/api/me/claims')
      .set(auth(trainerToken))
      .field('competencyId', radar.id)
      .field('level', '3')
      .field('evidenceType', 'CERTIFICATE')
      .field('certificateId', cert.id);
    expect(res.status).toBe(400);
  });

  it('are trainer-only', async () => {
    const trainee = await createUser({ role: 'TRAINEE' });
    const { accessToken } = await loginAs(trainee.email);
    const res = await request(app).put('/api/me/claims').set(auth(accessToken)).send({});
    expect(res.status).toBe(403);
  });
});

describe('verification changes the matching score', () => {
  it('verifying a certificate claim raises the fit score from 50% to 100%', async () => {
    const { radar, subject, trainer, trainerToken, adminToken } = await setup();
    const { claimId, certificateId } = await submitCertificateClaim(trainerToken, radar.id);

    // Unverified certificate: trust 0.5
    expect(await fitPercent(adminToken, subject.id, trainer.id)).toBe(50);

    const queue = await request(app).get('/api/verifications').set(auth(adminToken));
    expect(queue.body.claims.map((c: { id: string }) => c.id)).toEqual([claimId]);
    expect(queue.body.documents).toEqual([]); // the certificate is reviewed together with its claim

    const review = await request(app).post(`/api/verifications/claims/${claimId}`).set(auth(adminToken)).send({ decision: 'APPROVE' });
    expect(review.status).toBe(200);

    // Verified certificate: trust 1.0
    expect(await fitPercent(adminToken, subject.id, trainer.id)).toBe(100);
    expect((await prisma.certificate.findUniqueOrThrow({ where: { id: certificateId } })).status).toBe('VERIFIED');
    expect(await prisma.auditLog.count({ where: { action: 'CLAIM_VERIFIED', entityId: claimId } })).toBe(1);

    const after = await request(app).get('/api/verifications').set(auth(adminToken));
    expect(after.body.claims).toEqual([]);
  });

  it('editing a verified claim resets the verification (no raising a level after review)', async () => {
    const { radar, subject, trainer, trainerToken, adminToken } = await setup();
    const { claimId, certificateId } = await submitCertificateClaim(trainerToken, radar.id, 2);
    await request(app).post(`/api/verifications/claims/${claimId}`).set(auth(adminToken)).send({ decision: 'APPROVE' });
    expect(await fitPercent(adminToken, subject.id, trainer.id)).toBeCloseTo(66.7);

    await request(app)
      .put('/api/me/claims')
      .set(auth(trainerToken))
      .field('competencyId', radar.id)
      .field('level', '4')
      .field('evidenceType', 'CERTIFICATE')
      .field('certificateId', certificateId);

    // Back to unverified trust (0.5) and back in the admin's queue
    expect(await fitPercent(adminToken, subject.id, trainer.id)).toBe(50);
    const queue = await request(app).get('/api/verifications').set(auth(adminToken));
    expect(queue.body.claims).toHaveLength(1);
  });

  it('rejecting needs a reason, leaves trust at 0.5 and removes the claim from the queue', async () => {
    const { radar, subject, trainer, trainerToken, adminToken } = await setup();
    const { claimId } = await submitCertificateClaim(trainerToken, radar.id);

    const noReason = await request(app).post(`/api/verifications/claims/${claimId}`).set(auth(adminToken)).send({ decision: 'REJECT' });
    expect(noReason.status).toBe(400);

    const res = await request(app)
      .post(`/api/verifications/claims/${claimId}`)
      .set(auth(adminToken))
      .send({ decision: 'REJECT', reason: 'Certificate is for a basic course, not level 3' });
    expect(res.status).toBe(200);
    expect(await fitPercent(adminToken, subject.id, trainer.id)).toBe(50);

    const queue = await request(app).get('/api/verifications').set(auth(adminToken));
    expect(queue.body.claims).toEqual([]);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'CLAIM_REJECTED' } });
    expect(log.metadata).toMatchObject({ reason: 'Certificate is for a basic course, not level 3' });

    const again = await request(app).post(`/api/verifications/claims/${claimId}`).set(auth(adminToken)).send({ decision: 'APPROVE' });
    expect(again.status).toBe(409);
  });
});

describe('document queue (trainee certificates)', () => {
  it('lists a trainee certificate and lets an admin reject it with a reason', async () => {
    const { adminToken } = await setup();
    const trainee = await createUser({ role: 'TRAINEE' });
    const { accessToken } = await loginAs(trainee.email);
    const cert = await request(app)
      .post('/api/me/certificates')
      .set(auth(accessToken))
      .field('title', 'GIS basics')
      .field('issuer', 'IIRS')
      .attach('file', files.png, { filename: 'gis.png', contentType: 'image/png' });

    const queue = await request(app).get('/api/verifications').set(auth(adminToken));
    expect(queue.body.documents).toHaveLength(1);
    expect(queue.body.documents[0]).toMatchObject({ kind: 'CERTIFICATE', title: 'GIS basics', hasFile: true });

    const res = await request(app)
      .post(`/api/verifications/certificates/${cert.body.certificate.id}`)
      .set(auth(adminToken))
      .send({ decision: 'REJECT', reason: 'Image is unreadable' });
    expect(res.status).toBe(200);
    const stored = await prisma.certificate.findUniqueOrThrow({ where: { id: cert.body.certificate.id } });
    expect(stored).toMatchObject({ status: 'REJECTED', rejectionReason: 'Image is unreadable' });
  });

  it('is admin-only', async () => {
    const { trainerToken } = await setup();
    const res = await request(app).get('/api/verifications').set(auth(trainerToken));
    expect(res.status).toBe(403);
  });
});
