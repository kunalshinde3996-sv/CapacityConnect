import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, auth, createAdmin, createUser, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// Goa has 2 trainees below the AWS Calibration target (3); Pune has a verified AWS trainer.
async function setup() {
  const goa = await prisma.institute.create({ data: { code: 'NCPOR-GOA', name: 'NCPOR Goa', city: 'Goa' } });
  const pune = await prisma.institute.create({ data: { code: 'IMD-PUNE', name: 'IMD Pune', city: 'Pune' } });
  const aws = await prisma.competency.create({ data: { name: 'AWS Calibration', category: 'DOMAIN', description: 'x', targetLevel: 3 } });
  const subject = await prisma.subject.create({
    data: { name: 'AWS Installation and Calibration', description: 'x', requirements: { create: [{ competencyId: aws.id, minLevel: 3, weight: '1' }] } },
  });

  for (const level of [1, 2]) {
    const t = await createUser();
    await prisma.user.update({ where: { id: t.id }, data: { instituteId: goa.id } });
    await prisma.userCompetency.create({ data: { userId: t.id, competencyId: aws.id, level, source: 'ASSESSMENT' } });
  }
  const trainer = await createUser({ role: 'TRAINER' });
  await prisma.user.update({ where: { id: trainer.id }, data: { instituteId: pune.id } });
  const cert = await prisma.certificate.create({ data: { userId: trainer.id, title: 'AWS course', issuer: 'IMD', status: 'VERIFIED' } });
  await prisma.trainerCompetency.create({
    data: { userId: trainer.id, competencyId: aws.id, level: 4, evidenceType: 'CERTIFICATE', verified: true, verifiedAt: new Date(), certificateId: cert.id },
  });
  // A self-declared trainer at Goa does not count as supply
  const selfDeclared = await createUser({ role: 'TRAINER' });
  await prisma.user.update({ where: { id: selfDeclared.id }, data: { instituteId: goa.id } });
  await prisma.trainerCompetency.create({ data: { userId: selfDeclared.id, competencyId: aws.id, level: 4, evidenceType: 'SELF_DECLARED' } });

  const { token } = await createAdmin();
  return { token, subject };
}

describe('GET /api/skill-gaps', () => {
  it('shows demand at Goa, supply at Goa (none) and anywhere (1), and links to trainer matching', async () => {
    const { token, subject } = await setup();
    const res = await request(app).get('/api/skill-gaps?institute=NCPOR-GOA').set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.institute).toMatchObject({ code: 'NCPOR-GOA' });
    expect(res.body.rows[0]).toMatchObject({
      name: 'AWS Calibration',
      targetLevel: 3,
      teachingBar: 3,
      demand: 2,
      supplyHere: 0,
      supplyAll: 1,
      perTrainer: 2,
      subjects: [{ id: subject.id, name: 'AWS Installation and Calibration' }],
    });
  });

  it('without a filter, counts every institute', async () => {
    const { token } = await setup();
    const res = await request(app).get('/api/skill-gaps').set(auth(token));
    expect(res.body.rows[0]).toMatchObject({ demand: 2, supplyHere: 1, supplyAll: 1 });
    expect(res.body.institutes.map((i: { code: string }) => i.code)).toEqual(['IMD-PUNE', 'NCPOR-GOA']);
  });

  it('rejects an unknown institute and is admin only', async () => {
    const { token } = await setup();
    expect((await request(app).get('/api/skill-gaps?institute=NOPE').set(auth(token))).status).toBe(400);
    const trainer = await createUser({ role: 'TRAINER' });
    const { accessToken } = await loginAs(trainer.email);
    expect((await request(app).get('/api/skill-gaps').set(auth(accessToken))).status).toBe(403);
  });
});
