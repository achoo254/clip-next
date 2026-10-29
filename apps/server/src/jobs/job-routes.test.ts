import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { accounts, claimNextJob, createJob, DAILY_RENDER_LIMIT, markJobDone, renderJobs, type Db } from '@clip/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ORIGIN, startTestApp, type TestApp } from '../test-support';
import { CREATE_LIMIT, MAX_QUEUED_JOBS } from './job-routes';
import { templateById } from '@clip/templates';

/** A real JPEG of `width`×`height` from ffmpeg (`source`: an ffmpeg lavfi source), with an EXIF block (camera make "SECRETCAM") spliced in. */
function jpegWithExif(width: number, height: number, source = 'testsrc2'): Buffer {
  const out = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `${source}=s=${width}x${height}`, '-frames:v', '1', '-f', 'mjpeg', 'pipe:1'], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (out.status !== 0) throw new Error(`ffmpeg: ${out.stderr.toString()}`);
  const jpeg = out.stdout;
  // TIFF (little endian) with one IFD entry: Make (0x010f), ASCII, "SECRETCAM\0" stored after the IFD.
  const make = Buffer.from('SECRETCAM\0', 'latin1');
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x010f, 10);
  tiff.writeUInt16LE(2, 12);
  tiff.writeUInt32LE(make.length, 14);
  tiff.writeUInt32LE(tiff.length, 18);
  tiff.writeUInt32LE(0, 22);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff, make]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), app1, payload, jpeg.subarray(2)]);
}

const QUOTE = { quote: 'Học, học nữa, học mãi', author: 'Lênin' };
const WISHES = { line1: 'Chúc mừng sinh nhật', line2: 'Tuổi mới vui', line3: 'Yêu thương' };

async function doneJobs(db: Db, accountId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const now = new Date();
    const created = await createJob(db, { id: randomUUID(), accountId, templateId: 'trich-dan', fields: QUOTE, photoCount: 0 }, now);
    if (!created.ok) throw new Error('refused');
    await claimNextJob(db, now);
    await markJobDone(db, created.job.id, { outputBytes: 3, durationSeconds: 10, renderMs: 1 }, now);
    ids.push(created.job.id);
  }
  return ids;
}

let app: TestApp;
beforeEach(async () => {
  app = await startTestApp();
});
afterEach(async () => {
  await app.close();
});

describe('server basics', () => {
  it('answers /healthz', async () => {
    const res = await app.http().get('/healthz');
    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
  });

  it('says whether the browser is signed in', async () => {
    const none = { name: null, picture: null, email: null };
    expect((await app.http().get('/api/me')).body).toEqual({ signedIn: false, signInAvailable: false, ...none });
    const { cookie } = await app.signIn('sub-1');
    expect((await app.http().get('/api/me').set('Cookie', cookie)).body).toEqual({ signedIn: true, signInAvailable: false, ...none });
  });

  it('sends sign-in back with login=unavailable when no client secret is set', async () => {
    const res = await app.http().get('/auth/login?return=/tao');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/tao?login=unavailable');
  });
});

describe('POST /api/jobs', () => {
  it('needs a session and an allowed Origin', async () => {
    expect((await app.http().post('/api/jobs').set('Origin', ORIGIN).field('templateId', 'trich-dan')).status).toBe(401);
    const { cookie } = await app.signIn('sub-1');
    const res = await app.http().post('/api/jobs').set('Cookie', cookie).set('Origin', 'https://evil.example').field('templateId', 'trich-dan');
    expect(res.status).toBe(403);
  });

  it('queues a job with cleaned photos: at most 1080 px, no EXIF left', async () => {
    const { cookie } = await app.signIn('sub-1');
    const res = await app
      .http()
      .post('/api/jobs')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .field('templateId', 'chuc-mung')
      .field('fields', JSON.stringify(WISHES))
      .attach('photos', jpegWithExif(2400, 1600), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.job).toMatchObject({ templateId: 'chuc-mung', status: 'queued', expired: false });
    const stored = app.media.photo(res.body.job.id as string, 0);
    const bytes = await readFile(stored);
    expect(bytes.includes(Buffer.from('SECRETCAM'))).toBe(false);
    expect(bytes.includes(Buffer.from('Exif'))).toBe(false);
    const size = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', stored], { encoding: 'utf8' }).stdout.trim();
    expect(size).toBe('1080,720');
    // Nothing of the upload is left behind in tmp/.
    expect(await readdir(app.media.tmp)).toEqual([]);
  });

  it('refuses files that are not JPEG, PNG or WebP by their bytes, whatever their name says', async () => {
    const { cookie } = await app.signIn('sub-1');
    const res = await app
      .http()
      .post('/api/jobs')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .field('templateId', 'chuc-mung')
      .field('fields', JSON.stringify(WISHES))
      .attach('photos', Buffer.from('GIF89a not really a photo'), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('photo-type');
  });

  it('refuses a blank photo (one flat colour) with 400 photo-blank, and queues nothing', async () => {
    const { cookie } = await app.signIn('sub-1');
    const blank = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=800x600', '-frames:v', '1', '-f', 'mjpeg', 'pipe:1']).stdout;
    const res = await app
      .http()
      .post('/api/jobs')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .field('templateId', 'chuc-mung')
      .field('fields', JSON.stringify(WISHES))
      .attach('photos', blank, { filename: 'white.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('photo-blank');
    expect(await app.handle.db.select().from(renderJobs)).toHaveLength(0);
  });

  it('refuses more than three photos and invalid fields', async () => {
    const { cookie } = await app.signIn('sub-1');
    const photo = jpegWithExif(64, 64);
    let req = app.http().post('/api/jobs').set('Cookie', cookie).set('Origin', ORIGIN).field('templateId', 'chuc-mung').field('fields', JSON.stringify(WISHES));
    for (let i = 0; i < 4; i += 1) req = req.attach('photos', photo, { filename: `${i}.jpg`, contentType: 'image/jpeg' });
    expect((await req).body.error).toBe('too-many-photos');
    const missing = await app
      .http()
      .post('/api/jobs')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .field('templateId', 'trich-dan')
      .field('fields', JSON.stringify({ quote: '' }));
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ error: 'missing-field', field: 'quote' });
  });

  it('stores the chosen background, the first when none is sent, and refuses one the template lacks', async () => {
    const post = (cookie: string, templateId: string, fields: object, background?: string) => {
      const req = app.http().post('/api/jobs').set('Cookie', cookie).set('Origin', ORIGIN).field('templateId', templateId).field('fields', JSON.stringify(fields));
      return background === undefined ? req : req.field('background', background);
    };
    const first = await app.signIn('sub-1');
    const last = templateById('trich-dan').backgrounds;
    for (const bad of ['0', String(last + 1), '2.5', 'bg-2.webp', '-1']) {
      const res = await post(first.cookie, 'trich-dan', QUOTE, bad);
      expect(res.status, bad).toBe(400);
      expect(res.body, bad).toEqual({ error: 'invalid-background' });
    }
    const chart = { line1: 'a', line2: 'b', reading: 'r', animal: 'mui', cuc: 'moc-tam' };
    expect((await post(first.cookie, 'la-so', chart, '2')).body).toEqual({ error: 'invalid-background' });
    expect(await app.handle.db.select().from(renderJobs)).toEqual([]);

    expect((await post(first.cookie, 'trich-dan', QUOTE, String(last))).status).toBe(201);
    const second = await app.signIn('sub-2');
    expect((await post(second.cookie, 'trich-dan', QUOTE)).status).toBe(201);
    const stored = await app.handle.db.select({ background: renderJobs.background }).from(renderJobs);
    expect(stored.map((j) => j.background).sort()).toEqual([1, last]);
  });

  it('stores the chosen format, 9:16 when none is sent, and refuses any other', async () => {
    const post = (cookie: string, format?: string) => {
      const req = app.http().post('/api/jobs').set('Cookie', cookie).set('Origin', ORIGIN).field('templateId', 'trich-dan').field('fields', JSON.stringify(QUOTE));
      return format === undefined ? req : req.field('format', format);
    };
    const first = await app.signIn('sub-1');
    for (const bad of ['16:9', '1x1', '4:5 ', 'square']) {
      const res = await post(first.cookie, bad);
      expect(res.status, bad).toBe(400);
      expect(res.body, bad).toEqual({ error: 'invalid-format' });
    }
    expect((await post(first.cookie, '4:5')).status).toBe(201);
    const second = await app.signIn('sub-2');
    expect((await post(second.cookie)).status).toBe(201);
    const stored = await app.handle.db.select({ format: renderJobs.format }).from(renderJobs);
    expect(stored.map((j) => j.format).sort()).toEqual(['4:5', '9:16']);
  });

  it('allows one waiting job per account (429 job-in-progress)', async () => {
    const { cookie } = await app.signIn('sub-1');
    const post = () =>
      app.http().post('/api/jobs').set('Cookie', cookie).set('Origin', ORIGIN).field('templateId', 'trich-dan').field('fields', JSON.stringify(QUOTE));
    expect((await post()).status).toBe(201);
    const second = await post();
    expect(second.status).toBe(429);
    expect(second.body).toEqual({ error: 'job-in-progress' });
  });

  it('refuses the sixth render of the Vietnamese day with 429 daily-limit and when it resets', async () => {
    const { accountId, cookie } = await app.signIn('sub-1');
    await doneJobs(app.handle.db, accountId, DAILY_RENDER_LIMIT);
    const res = await app.http().post('/api/jobs').set('Cookie', cookie).set('Origin', ORIGIN).field('templateId', 'trich-dan').field('fields', JSON.stringify(QUOTE));
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('daily-limit');
    expect(res.body.limit).toBe(DAILY_RENDER_LIMIT);
    // Next 00:00 in Vietnam is 17:00 UTC.
    expect(res.body.resetAt).toMatch(/T17:00:00\.000Z$/);
    expect(await app.handle.db.select().from(renderJobs)).toHaveLength(DAILY_RENDER_LIMIT);
    const list = await app.http().get('/api/jobs').set('Cookie', cookie);
    expect(list.body.limits).toMatchObject({ perDay: DAILY_RENDER_LIMIT, usedToday: DAILY_RENDER_LIMIT });
  });
});

describe('protection of the shared server', () => {
  const post = (cookie: string) =>
    app.http().post('/api/jobs').set('Cookie', cookie).set('Origin', ORIGIN).field('templateId', 'trich-dan').field('fields', JSON.stringify(QUOTE));

  it('refuses pictures over 24 MP before decoding them', async () => {
    const { cookie } = await app.signIn('sub-1');
    const res = await app
      .http()
      .post('/api/jobs')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .field('templateId', 'chuc-mung')
      .field('fields', JSON.stringify(WISHES))
      .attach('photos', jpegWithExif(6000, 4100, 'color'), { filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('photo-too-big');
  });

  it('turns new jobs away with 503 server-busy when the queue is full', async () => {
    const now = new Date();
    for (let i = 0; i < MAX_QUEUED_JOBS; i += 1) {
      const [account] = await app.handle.db.insert(accounts).values({ sub: `q${i}`, createdAt: now }).returning();
      if (!account) throw new Error('no account');
      await createJob(app.handle.db, { id: randomUUID(), accountId: account.id, templateId: 'trich-dan', fields: QUOTE, photoCount: 0 }, now);
    }
    const res = await post((await app.signIn('late')).cookie);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'server-busy' });
  });

  it('turns new jobs away when the media disk is nearly full', async () => {
    await app.close();
    app = await startTestApp({}, { freeBytes: async () => 1024 ** 3 });
    const res = await post((await app.signIn('sub-1')).cookie);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'server-busy' });
  });

  it('limits render requests per account, refused ones included', async () => {
    const { cookie } = await app.signIn('sub-1');
    const statuses: number[] = [];
    for (let i = 0; i <= CREATE_LIMIT.limit; i += 1) statuses.push((await post(cookie)).status);
    // The first is queued, the next ones wait for it (429 job-in-progress), the one past the limit is cut off.
    expect(statuses[0]).toBe(201);
    const last = await post(cookie);
    expect(last.status).toBe(429);
    expect(last.body.error).toBe('too-many-requests');
    // Another account is not affected.
    expect((await post((await app.signIn('sub-2')).cookie)).status).toBe(201);
  });
});

describe('videos', () => {
  it('lets only the owner download, from Node in dev', async () => {
    const owner = await app.signIn('owner');
    const other = await app.signIn('other');
    const [id] = await doneJobs(app.handle.db, owner.accountId, 1);
    if (!id) throw new Error('no job');
    await mkdir(app.media.videos, { recursive: true });
    await writeFile(app.media.video(id), 'mp4');
    const res = await app.http().get(`/api/jobs/${id}/download`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="clip-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.mp4"$/);
    expect((await app.http().get(`/api/jobs/${id}/download`).set('Cookie', other.cookie)).status).toBe(404);
    expect((await app.http().get(`/api/jobs/${id}`).set('Cookie', other.cookie)).status).toBe(404);
    expect((await app.http().get('/api/jobs/not-a-uuid/video').set('Cookie', owner.cookie)).status).toBe(404);
  });
});

describe('videos behind nginx', () => {
  it('hands the file to nginx with X-Accel-Redirect after the ownership check', async () => {
    await app.close();
    app = await startTestApp({ videoDelivery: 'accel' });
    const owner = await app.signIn('owner');
    const [id] = await doneJobs(app.handle.db, owner.accountId, 1);
    const res = await app.http().get(`/api/jobs/${id}/video`).set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.headers['x-accel-redirect']).toBe(`/_clip_media/videos/${id}.mp4`);
    expect(res.headers['content-disposition']).toMatch(/^inline; /);
    // No bytes from Node: nginx sends the file.
    expect(res.headers['content-length'] ?? '0').toBe('0');
  });
});
