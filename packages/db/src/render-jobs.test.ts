import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openPglite, type DbHandle } from './client';
import {
  claimNextJob,
  createJob,
  DAILY_RENDER_LIMIT,
  failStuckJobs,
  markJobDone,
  markJobFailed,
  rendersToday,
  STUCK_AFTER_MS,
  type NewJob,
} from './render-jobs';
import { accounts, renderJobs } from './schema';

let handle: DbHandle;

beforeEach(async () => {
  handle = await openPglite();
});
afterEach(async () => {
  await handle.close();
});

async function account(): Promise<string> {
  const [row] = await handle.db.insert(accounts).values({ sub: randomUUID(), createdAt: new Date() }).returning();
  if (!row) throw new Error('no account');
  return row.id;
}

const job = (accountId: string): NewJob => ({ id: randomUUID(), accountId, templateId: 'trich-dan', fields: { quote: 'x' }, photoCount: 0 });

/** 10:00 on 26/10/2026 in Vietnam (03:00 UTC). */
const MORNING = new Date('2026-10-26T03:00:00Z');

/** Runs a job through the queue to `done`. */
async function finish(id: string, now: Date): Promise<void> {
  const claimed = await claimNextJob(handle.db, now);
  expect(claimed?.id).toBe(id);
  await markJobDone(handle.db, id, { outputBytes: 1, durationSeconds: 10, renderMs: 1 }, now);
}

describe('render job limits', () => {
  it('refuses a second job while one is queued or rendering', async () => {
    const a = await account();
    expect((await createJob(handle.db, job(a), MORNING)).ok).toBe(true);
    expect(await createJob(handle.db, job(a), MORNING)).toEqual({ ok: false, reason: 'job-in-progress' });
    await claimNextJob(handle.db, MORNING);
    expect(await createJob(handle.db, job(a), MORNING)).toEqual({ ok: false, reason: 'job-in-progress' });
  });

  it('enforces one active job in the database too (two requests racing past the check)', async () => {
    const a = await account();
    const now = MORNING;
    await handle.db.insert(renderJobs).values({ ...job(a), status: 'queued', createdAt: now, expiresAt: now });
    await expect(handle.db.insert(renderJobs).values({ ...job(a), status: 'queued', createdAt: now, expiresAt: now })).rejects.toThrow();
  });

  it('allows five renders per Vietnamese day; the sixth is refused until local midnight', async () => {
    const a = await account();
    for (let i = 0; i < DAILY_RENDER_LIMIT; i += 1) {
      const created = await createJob(handle.db, job(a), MORNING);
      if (!created.ok) throw new Error(`render ${i + 1} refused`);
      await finish(created.job.id, MORNING);
    }
    const sixth = await createJob(handle.db, job(a), MORNING);
    expect(sixth).toEqual({ ok: false, reason: 'daily-limit', resetAt: new Date('2026-10-26T17:00:00Z') });
    // 23:59 Vietnam time is still the same day; 00:00 is the next.
    expect((await createJob(handle.db, job(a), new Date('2026-10-26T16:59:00Z'))).ok).toBe(false);
    expect((await createJob(handle.db, job(a), new Date('2026-10-26T17:00:00Z'))).ok).toBe(true);
  });

  it('does not count failed renders, and counts per account', async () => {
    const a = await account();
    const b = await account();
    const created = await createJob(handle.db, job(a), MORNING);
    if (!created.ok) throw new Error('refused');
    await claimNextJob(handle.db, MORNING);
    await markJobFailed(handle.db, created.job.id, 'render-failed', MORNING);
    expect(await rendersToday(handle.db, a, MORNING)).toBe(0);
    expect((await createJob(handle.db, job(b), MORNING)).ok).toBe(true);
    expect(await rendersToday(handle.db, b, MORNING)).toBe(1);
  });
});

describe('render queue', () => {
  it('hands out jobs oldest first, each to exactly one of several workers polling at once', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const created = await createJob(handle.db, job(await account()), new Date(MORNING.getTime() + i * 1000));
      if (!created.ok) throw new Error('refused');
      ids.push(created.job.id);
    }
    // Six workers poll at the same moment for four jobs.
    const claims = await Promise.all(Array.from({ length: 6 }, () => claimNextJob(handle.db, MORNING)));
    const claimed = claims.flatMap((c) => (c ? [c.id] : []));
    expect(claimed).toHaveLength(4);
    expect(new Set(claimed).size).toBe(4);
    expect([...claimed].sort()).toEqual([...ids].sort());
    expect(claims.filter((c) => c === null)).toHaveLength(2);
    const rows = await handle.db.select().from(renderJobs);
    expect(rows.every((r) => r.status === 'rendering' && r.startedAt?.getTime() === MORNING.getTime())).toBe(true);
  });

  it('fails a job stuck in rendering for more than 10 minutes, and ignores the late result of its worker', async () => {
    const created = await createJob(handle.db, job(await account()), MORNING);
    if (!created.ok) throw new Error('refused');
    await claimNextJob(handle.db, MORNING);
    expect(await failStuckJobs(handle.db, new Date(MORNING.getTime() + STUCK_AFTER_MS))).toEqual([]);
    expect(await failStuckJobs(handle.db, new Date(MORNING.getTime() + STUCK_AFTER_MS + 1))).toEqual([created.job.id]);
    const [row] = await handle.db.select().from(renderJobs).where(eq(renderJobs.id, created.job.id));
    expect(row?.status).toBe('failed');
    expect(row?.error).toBe('stuck');
    expect(await markJobDone(handle.db, created.job.id, { outputBytes: 1, durationSeconds: 1, renderMs: 1 }, MORNING)).toBe(false);
    // Its account may queue again.
    expect((await createJob(handle.db, job(created.job.accountId), MORNING)).ok).toBe(true);
  });
});
