import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { EvidenceType, UserStatus } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';
import { app, createAdmin, createUser, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function setupSubject() {
  const radar = await prisma.competency.create({ data: { name: 'Radar Meteorology', category: 'DOMAIN', description: 'x' } });
  const nowcast = await prisma.competency.create({ data: { name: 'Nowcasting', category: 'DOMAIN', description: 'x' } });
  const subject = await prisma.subject.create({
    data: {
      name: 'Doppler Weather Radar Operations',
      description: 'Operating and interpreting DWR products',
      requirements: {
        create: [
          { competencyId: radar.id, minLevel: 3, weight: '0.6' },
          { competencyId: nowcast.id, minLevel: 2, weight: '0.4' },
        ],
      },
    },
  });
  return { subject, radar, nowcast };
}

async function createTrainer(
  claims: { competencyId: string; level: number; evidenceType: EvidenceType; verified?: boolean; evidenceNote?: string }[],
  status: UserStatus = 'APPROVED',
) {
  const trainer = await createUser({ role: 'TRAINER', status });
  for (const c of claims) {
    await prisma.trainerCompetency.create({ data: { userId: trainer.id, verified: false, ...c } });
  }
  return trainer;
}

describe('GET /api/subjects/:id/trainer-matches', () => {
  it('ranks approved trainers with a per-competency breakdown and partial-fit flag', async () => {
    const { token } = await createAdmin();
    const { subject, radar, nowcast } = await setupSubject();

    const expert = await createTrainer([
      { competencyId: radar.id, level: 4, evidenceType: 'CERTIFICATE', verified: true, evidenceNote: 'WMO radar course' },
      { competencyId: nowcast.id, level: 2, evidenceType: 'EXPERIENCE' },
    ]);
    const partial = await createTrainer([{ competencyId: radar.id, level: 3, evidenceType: 'SELF_DECLARED' }]);

    const res = await request(app).get(`/api/subjects/${subject.id}/trainer-matches`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.subject.requirements).toEqual([
      { competency: { id: radar.id, name: 'Radar Meteorology', category: 'DOMAIN' }, minLevel: 3, weight: 0.6 },
      { competency: { id: nowcast.id, name: 'Nowcasting', category: 'DOMAIN' }, minLevel: 2, weight: 0.4 },
    ]);

    const [first, second] = res.body.matches;
    // expert: 0.6 x 1.0 + 0.4 x 0.8 = 0.92
    expect(first).toMatchObject({ rank: 1, fitPercent: 92, partialFit: false, trainer: { id: expert.id } });
    expect(first.breakdown[0]).toMatchObject({
      competencyName: 'Radar Meteorology',
      claimedLevel: 4,
      levelRatio: 1,
      trust: 1,
      status: 'MEETS',
      evidenceNote: 'WMO radar course',
    });
    // partial: 0.6 x 0.5 = 0.30, nowcasting missing
    expect(second).toMatchObject({ rank: 2, fitPercent: 30, partialFit: true, missingCompetencies: ['Nowcasting'] });
    expect(second.trainer.id).toBe(partial.id);
    expect(second.breakdown[1]).toMatchObject({ status: 'MISSING', contribution: 0 });

    // Never leaks credentials
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('includes approved trainers with no claims, and excludes pending/disabled trainers and non-trainers', async () => {
    const { token } = await createAdmin();
    const { subject, radar } = await setupSubject();
    const noClaims = await createTrainer([]);
    await createTrainer([{ competencyId: radar.id, level: 4, evidenceType: 'CERTIFICATE', verified: true }], 'PENDING');
    await createTrainer([{ competencyId: radar.id, level: 4, evidenceType: 'CERTIFICATE', verified: true }], 'DISABLED');
    await createUser({ role: 'TRAINEE' });

    const res = await request(app).get(`/api/subjects/${subject.id}/trainer-matches`).set('Authorization', `Bearer ${token}`);

    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0]).toMatchObject({ trainer: { id: noClaims.id }, fitPercent: 0, partialFit: true });
  });

  it('returns 422 when the subject weights do not sum to 1', async () => {
    const { token } = await createAdmin();
    const { subject } = await setupSubject();
    await prisma.subjectRequirement.updateMany({ where: { subjectId: subject.id }, data: { weight: '0.2' } });

    const res = await request(app).get(`/api/subjects/${subject.id}/trainer-matches`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SUBJECT_MISCONFIGURED');
  });

  it('returns 404 for an unknown subject', async () => {
    const { token } = await createAdmin();
    const res = await request(app).get('/api/subjects/nope/trainer-matches').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('is admin only', async () => {
    const { subject } = await setupSubject();
    const trainer = await createUser({ role: 'TRAINER' });
    const { accessToken } = await loginAs(trainer.email);
    const res = await request(app).get(`/api/subjects/${subject.id}/trainer-matches`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/subjects', () => {
  it('lists subjects with their requirements as plain-number weights', async () => {
    const { token } = await createAdmin();
    await setupSubject();
    const res = await request(app).get('/api/subjects').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.subjects).toHaveLength(1);
    expect(res.body.subjects[0].requirements.map((r: { weight: number }) => r.weight)).toEqual([0.6, 0.4]);
  });
});
