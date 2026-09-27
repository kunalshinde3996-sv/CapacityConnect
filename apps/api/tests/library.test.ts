import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { app, auth, createUser, files, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function session(role: 'TRAINEE' | 'TRAINER' | 'ADMIN') {
  const user = await createUser({ role });
  const { accessToken } = await loginAs(user.email);
  return { user, token: accessToken };
}

async function competencies() {
  const radar = await prisma.competency.create({ data: { name: 'Radar Meteorology', category: 'DOMAIN', description: 'x' } });
  const cyber = await prisma.competency.create({ data: { name: 'Network Security', category: 'FUNCTIONAL', description: 'x' } });
  return { radar, cyber };
}

function upload(token: string, fields: Record<string, string>, file: Buffer, filename: string, contentType: string) {
  let req = request(app).post('/api/library').set(auth(token));
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  return req.attach('file', file, { filename, contentType });
}

const lecture = (competencyIds: string[], extra: Record<string, string> = {}) => ({
  title: 'How a Doppler radar scans',
  type: 'VIDEO',
  competencyIds: JSON.stringify(competencyIds),
  ...extra,
});

describe('uploading to the library', () => {
  it('a trainer uploads a lecture video tagged with competencies', async () => {
    const { radar } = await competencies();
    const trainer = await session('TRAINER');
    const res = await upload(trainer.token, lecture([radar.id]), files.mp4, 'scan.mp4', 'video/mp4');

    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ title: 'How a Doppler radar scans', type: 'VIDEO', mimeType: 'video/mp4', hasFile: true });
    expect(res.body.item.competencies.map((c: { competency: { name: string } }) => c.competency.name)).toEqual(['Radar Meteorology']);
    expect(res.body.item.fileKey).toBeUndefined();
  });

  it('the file must match the item type (a VIDEO must be an MP4)', async () => {
    const { radar } = await competencies();
    const trainer = await session('TRAINER');
    const res = await upload(trainer.token, lecture([radar.id]), files.pdf, 'slides.pdf', 'application/pdf');
    expect(res.status).toBe(415);
  });

  it('accepts notes as DOCX, and rejects image files in the library', async () => {
    const { radar } = await competencies();
    const trainer = await session('TRAINER');
    const docx = await upload(
      trainer.token,
      { title: 'Nowcasting notes', type: 'DOCUMENT', competencyIds: JSON.stringify([radar.id]) },
      files.docx,
      'notes.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(docx.status).toBe(201);
    const png = await upload(trainer.token, { title: 'Poster', type: 'DOCUMENT', competencyIds: JSON.stringify([radar.id]) }, files.png, 'poster.png', 'image/png');
    expect(png.status).toBe(415);
  });

  it('requires at least one competency tag', async () => {
    await competencies();
    const trainer = await session('TRAINER');
    const res = await upload(trainer.token, lecture([]), files.mp4, 'scan.mp4', 'video/mp4');
    expect(res.status).toBe(400);
  });

  it('trainees cannot upload', async () => {
    const { radar } = await competencies();
    const trainee = await session('TRAINEE');
    const res = await upload(trainee.token, lecture([radar.id]), files.mp4, 'scan.mp4', 'video/mp4');
    expect(res.status).toBe(403);
  });

  it('can only attach material to a course the trainer teaches', async () => {
    const { radar } = await competencies();
    const owner = await session('TRAINER');
    const course = await prisma.course.create({ data: { title: 'DWR', description: 'x', createdById: owner.user.id, trainerId: owner.user.id } });
    const other = await session('TRAINER');
    const res = await upload(other.token, lecture([radar.id], { courseId: course.id }), files.mp4, 'scan.mp4', 'video/mp4');
    expect(res.status).toBe(403);
    const ok = await upload(owner.token, lecture([radar.id], { courseId: course.id }), files.mp4, 'scan.mp4', 'video/mp4');
    expect(ok.status).toBe(201);
  });
});

describe('browsing the library', () => {
  it('search and filter by competency and type', async () => {
    const { radar, cyber } = await competencies();
    const trainer = await session('TRAINER');
    await upload(trainer.token, lecture([radar.id]), files.mp4, 'scan.mp4', 'video/mp4');
    await upload(trainer.token, { title: 'Cyber hygiene slides', type: 'SLIDES', competencyIds: JSON.stringify([cyber.id]) }, files.pdf, 's.pdf', 'application/pdf');

    const trainee = await session('TRAINEE');
    const titles = async (qs: string) =>
      (await request(app).get(`/api/library?${qs}`).set(auth(trainee.token))).body.items.map((i: { title: string }) => i.title);

    expect(await titles(`competencyId=${cyber.id}`)).toEqual(['Cyber hygiene slides']);
    expect(await titles('type=VIDEO')).toEqual(['How a Doppler radar scans']);
    expect(await titles('q=hygiene')).toEqual(['Cyber hygiene slides']);
  });

  it('a trainee gets a signed link that streams the video (with Range support)', async () => {
    const { radar } = await competencies();
    const trainer = await session('TRAINER');
    const item = await upload(trainer.token, lecture([radar.id]), files.mp4, 'scan.mp4', 'video/mp4');
    const trainee = await session('TRAINEE');

    const link = await request(app).get(`/api/library/${item.body.item.id}/file`).set(auth(trainee.token));
    expect(link.status).toBe(200);
    // Long enough to watch a lecture (2 hours), unlike the 10-minute document links
    expect(new Date(link.body.expiresAt).getTime() - Date.now()).toBeGreaterThan(110 * 60 * 1000);

    const part = await request(app).get(link.body.url).set('Range', 'bytes=4-7');
    expect(part.status).toBe(206);
    expect(part.headers['content-type']).toBe('video/mp4');
    expect(part.body.toString()).toBe('ftyp');
  });

  it('unpublished items are hidden from trainees', async () => {
    const { radar } = await competencies();
    const trainer = await session('TRAINER');
    const item = await upload(trainer.token, lecture([radar.id]), files.mp4, 'scan.mp4', 'video/mp4');
    await request(app).patch(`/api/library/${item.body.item.id}`).set(auth(trainer.token)).send({ isPublished: false });

    const trainee = await session('TRAINEE');
    expect((await request(app).get('/api/library').set(auth(trainee.token))).body.items).toEqual([]);
    expect((await request(app).get(`/api/library/${item.body.item.id}/file`).set(auth(trainee.token))).status).toBe(404);
    expect((await request(app).get('/api/library?mine=true').set(auth(trainer.token))).body.items).toHaveLength(1);
  });

  it('files need a signed-in user: no token, no link', async () => {
    const { radar } = await competencies();
    const trainer = await session('TRAINER');
    const item = await upload(trainer.token, lecture([radar.id]), files.mp4, 'scan.mp4', 'video/mp4');
    expect((await request(app).get(`/api/library/${item.body.item.id}/file`)).status).toBe(401);
  });

  it('only the uploader (or an admin) can delete', async () => {
    const { radar } = await competencies();
    const trainer = await session('TRAINER');
    const item = await upload(trainer.token, lecture([radar.id]), files.mp4, 'scan.mp4', 'video/mp4');
    const other = await session('TRAINER');
    expect((await request(app).delete(`/api/library/${item.body.item.id}`).set(auth(other.token))).status).toBe(404);
    expect((await request(app).delete(`/api/library/${item.body.item.id}`).set(auth(trainer.token))).status).toBe(204);
  });
});
