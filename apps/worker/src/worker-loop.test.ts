import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { accounts, createJob, mediaLayout, openPglite, renderJobs, STUCK_AFTER_MS, type DbHandle, type MediaLayout } from '@clip/db';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RenderError, type RenderInput } from './render';
import { processNextJob, type Renderer } from './worker-loop';
import { pickTrack, templateById } from '@clip/templates';

let handle: DbHandle;
let media: MediaLayout;
let dir: string;
const quiet = { info: () => undefined, warn: () => undefined };

beforeEach(async () => {
  handle = await openPglite();
  dir = await mkdtemp(path.join(os.tmpdir(), 'clip-worker-'));
  media = mediaLayout(dir);
});
afterEach(async () => {
  await handle.close();
  await rm(dir, { recursive: true, force: true });
});

async function queue(
  templateId: string,
  fields: Record<string, string>,
  photos: number,
  at = new Date(),
  background?: number,
  format?: string,
): Promise<string> {
  const [account] = await handle.db.insert(accounts).values({ sub: randomUUID(), createdAt: at }).returning();
  if (!account) throw new Error('no account');
  const id = randomUUID();
  for (let i = 0; i < photos; i += 1) {
    await mkdir(media.inputDir(id), { recursive: true });
    await writeFile(media.photo(id, i), `photo ${i}`);
  }
  const created = await createJob(handle.db, { id, accountId: account.id, templateId, fields, background, format, photoCount: photos }, at);
  if (!created.ok) throw new Error('refused');
  return id;
}

/** Stands in for hyperframes: writes a file where the video goes and records what it was asked. */
function recordingRenderer(seen: RenderInput[]): Renderer {
  return async (input) => {
    seen.push(input);
    await mkdir(path.dirname(input.output), { recursive: true });
    await writeFile(input.output, 'mp4');
    return { bytes: 3, durationSeconds: 12, renderMs: 5 };
  };
}

async function job(id: string) {
  const [row] = await handle.db.select().from(renderJobs).where(eq(renderJobs.id, id));
  return row;
}

describe('worker', () => {
  it('renders a job with its fields and photos as composition variables, then deletes the photos', async () => {
    const id = await queue('chuc-mung', { line1: 'a', line2: 'b', line3: 'c' }, 2);
    const seen: RenderInput[] = [];
    expect(await processNextJob({ db: handle.db, media, render: recordingRenderer(seen), log: quiet })).toBe('done');
    expect(seen[0]?.variables).toEqual({ background: '1', line1: 'a', line2: 'b', line3: 'c', photo1: 'photos/photo-1.jpg', photo2: 'photos/photo-2.jpg', photo3: '' });
    expect(seen[0]?.photos).toEqual([media.photo(id, 0), media.photo(id, 1)]);
    expect(seen[0]?.output).toBe(media.video(id));
    expect(await job(id)).toMatchObject({ status: 'done', outputBytes: 3, durationSeconds: 12, renderMs: 5 });
    await expect(stat(media.inputDir(id))).rejects.toThrow();
    expect(await readFile(media.video(id), 'utf8')).toBe('mp4');
    expect(await processNextJob({ db: handle.db, media, render: recordingRenderer(seen), log: quiet })).toBe('idle');
  });

  it('passes the chosen background to the composition, and fails a job whose background the template lacks', async () => {
    const last = templateById('trich-dan').backgrounds;
    const chosen = await queue('trich-dan', { quote: 'q', author: '' }, 0, new Date(), last);
    const seen: RenderInput[] = [];
    expect(await processNextJob({ db: handle.db, media, render: recordingRenderer(seen), log: quiet })).toBe('done');
    expect(seen[0]?.variables).toMatchObject({ background: String(last), quote: 'q' });
    expect(seen[0]?.background).toBe(last);
    expect(await job(chosen)).toMatchObject({ background: last });

    const missing = await queue('la-so', { name: '', line1: 'a', line2: 'b', reading: 'r', animal: 'mui', star: '', cuc: 'moc-tam' }, 0, new Date(), 2);
    expect(await processNextJob({ db: handle.db, media, render: recordingRenderer(seen), log: quiet })).toBe('failed');
    expect(await job(missing)).toMatchObject({ status: 'failed', error: 'render-failed' });
    expect(seen).toHaveLength(1);
  });

  it('renders a job in its format, 9:16 for a job without one', async () => {
    const square = await queue('trich-dan', { quote: 'q', author: '' }, 0, new Date(), undefined, '1:1');
    const seen: RenderInput[] = [];
    expect(await processNextJob({ db: handle.db, media, render: recordingRenderer(seen), log: quiet })).toBe('done');
    expect(seen[0]?.format).toBe('1:1');
    expect(await job(square)).toMatchObject({ format: '1:1' });

    await queue('trich-dan', { quote: 'q', author: '' }, 0);
    expect(await processNextJob({ db: handle.db, media, render: recordingRenderer(seen), log: quiet })).toBe('done');
    expect(seen[1]?.format).toBe('9:16');
  });

  it('plays the track picked from the job id, the same one each time the job is rendered', async () => {
    const id = await queue('trich-dan', { quote: 'q', author: '' }, 0);
    const seen: RenderInput[] = [];
    expect(await processNextJob({ db: handle.db, media, render: recordingRenderer(seen), log: quiet })).toBe('done');
    expect(seen[0]?.music).toBe(pickTrack(templateById('trich-dan'), id));
    expect(seen[0]?.background).toBe(1);
  });

  it('marks a job failed with the render error code', async () => {
    const id = await queue('trich-dan', { quote: 'q', author: '' }, 0);
    const failing: Renderer = async () => {
      throw new RenderError('timeout', 'killed');
    };
    expect(await processNextJob({ db: handle.db, media, render: failing, log: quiet })).toBe('failed');
    expect(await job(id)).toMatchObject({ status: 'failed', error: 'timeout' });
  });

  it('two workers polling together render each job once', async () => {
    const ids = [await queue('trich-dan', { quote: 'a', author: '' }, 0), await queue('trich-dan', { quote: 'b', author: '' }, 0)];
    const seen: RenderInput[] = [];
    // A render that takes a moment, so both workers are inside one at the same time.
    const slow: Renderer = async (input, signal) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return recordingRenderer(seen)(input, signal);
    };
    const outcomes = await Promise.all([1, 2].map(() => processNextJob({ db: handle.db, media, render: slow, log: quiet })));
    expect(outcomes).toEqual(['done', 'done']);
    expect(seen.map((s) => s.output).sort()).toEqual(ids.map((id) => media.video(id)).sort());
  });

  it('puts the job back in the queue, photos kept, when the worker stops mid-render', async () => {
    const id = await queue('chuc-mung', { line1: 'a', line2: 'b', line3: 'c' }, 1);
    const abort = new AbortController();
    const stopping: Renderer = async () => {
      abort.abort();
      throw new RenderError('aborted', 'stopping');
    };
    expect(await processNextJob({ db: handle.db, media, render: stopping, log: quiet, signal: abort.signal })).toBe('requeued');
    expect(await job(id)).toMatchObject({ status: 'queued', startedAt: null, error: null });
    expect(await readFile(media.photo(id, 0), 'utf8')).toBe('photo 0');
    // A stopping worker takes no new job.
    expect(await processNextJob({ db: handle.db, media, render: stopping, log: quiet, signal: abort.signal })).toBe('idle');
  });

  it('fails a timed-out job and then calls onTimeout (the service exits there)', async () => {
    const id = await queue('trich-dan', { quote: 'q', author: '' }, 0);
    const calls: string[] = [];
    const slow: Renderer = async () => {
      throw new RenderError('timeout', 'killed');
    };
    const onTimeout = async (): Promise<void> => {
      calls.push((await job(id))?.status ?? 'missing');
    };
    expect(await processNextJob({ db: handle.db, media, render: slow, log: quiet, onTimeout: () => void onTimeout() })).toBe('failed');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toEqual(['failed']);
  });

  it('fails a job stuck in rendering and drops the video its worker writes too late', async () => {
    const start = new Date('2026-10-26T03:00:00Z');
    const stuckId = await queue('trich-dan', { quote: 'a', author: '' }, 0, start);
    let clock = start;
    const now = (): Date => clock;
    // The first worker claims the job, then hangs past the stuck limit while another worker's turn runs.
    const hanging: Renderer = async (input, signal) => {
      clock = new Date(start.getTime() + STUCK_AFTER_MS + 1_000);
      expect(await processNextJob({ db: handle.db, media, render: recordingRenderer([]), log: quiet, now })).toBe('idle');
      expect(await job(stuckId)).toMatchObject({ status: 'failed', error: 'stuck' });
      return recordingRenderer([])(input, signal);
    };
    expect(await processNextJob({ db: handle.db, media, render: hanging, log: quiet, now })).toBe('failed');
    expect(await job(stuckId)).toMatchObject({ status: 'failed', error: 'stuck' });
    await expect(stat(media.video(stuckId))).rejects.toThrow();
  });
});
