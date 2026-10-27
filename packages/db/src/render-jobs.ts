import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import type { Db } from './client';
import { renderJobs, type RenderJob } from './schema';
import { nextVietnamDayStart, vietnamDayStart } from './vietnam-day';

/** Renders per account per Vietnamese calendar day (failed jobs do not count: the failure was ours). */
export const DAILY_RENDER_LIMIT = 5;
/** Rendered videos are kept this long, then deleted. */
export const VIDEO_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** A job rendering longer than this is taken as stuck (its worker died or hung) and marked failed. */
export const STUCK_AFTER_MS = 10 * 60 * 1000;

export interface NewJob {
  readonly id: string;
  readonly accountId: string;
  readonly templateId: string;
  readonly fields: Record<string, string>;
  /** Chosen background (1-based, already validated); the first when omitted. */
  readonly background?: number;
  readonly photoCount: number;
}

export type CreateJobResult =
  | { readonly ok: true; readonly job: RenderJob }
  | { readonly ok: false; readonly reason: 'daily-limit'; readonly resetAt: Date }
  | { readonly ok: false; readonly reason: 'job-in-progress' };

/** Postgres unique_violation: the one-active-job index refused a second queued/rendering job. */
function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if ((e as Error & { code?: unknown }).code === '23505') return true;
  }
  return false;
}

/** Jobs of the account created today (Vietnam time) that count against the daily limit. */
export async function rendersToday(db: Db, accountId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(renderJobs)
    .where(and(eq(renderJobs.accountId, accountId), gte(renderJobs.createdAt, vietnamDayStart(now)), ne(renderJobs.status, 'failed')));
  return row?.n ?? 0;
}

/** Jobs waiting for the worker, all accounts together. */
export async function queuedCount(db: Db): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(renderJobs).where(eq(renderJobs.status, 'queued'));
  return row?.n ?? 0;
}

/** Whether the account may queue a render now, before any upload is processed. */
export async function checkJobAllowed(db: Db, accountId: string, now: Date): Promise<CreateJobResult | null> {
  const [active] = await db
    .select({ id: renderJobs.id })
    .from(renderJobs)
    .where(and(eq(renderJobs.accountId, accountId), inArray(renderJobs.status, ['queued', 'rendering'])))
    .limit(1);
  if (active) return { ok: false, reason: 'job-in-progress' };
  if ((await rendersToday(db, accountId, now)) >= DAILY_RENDER_LIMIT) return { ok: false, reason: 'daily-limit', resetAt: nextVietnamDayStart(now) };
  return null;
}

/**
 * Queues a render. The daily count is checked here; the one-active-job rule is the unique index, so two requests
 * racing each other cannot both get in (and with one active job at a time, the count cannot be raced past either).
 */
export async function createJob(db: Db, job: NewJob, now: Date): Promise<CreateJobResult> {
  const refused = await checkJobAllowed(db, job.accountId, now);
  if (refused) return refused;
  try {
    const [row] = await db
      .insert(renderJobs)
      .values({ ...job, status: 'queued', createdAt: now, expiresAt: new Date(now.getTime() + VIDEO_RETENTION_MS) })
      .returning();
    if (!row) throw new Error('render job insert returned no row');
    return { ok: true, job: row };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'job-in-progress' };
    throw error;
  }
}

/** The account's latest jobs, newest first. */
export async function listJobs(db: Db, accountId: string, limit = 30): Promise<RenderJob[]> {
  return db.select().from(renderJobs).where(eq(renderJobs.accountId, accountId)).orderBy(desc(renderJobs.createdAt)).limit(limit);
}

/** One job, only when it belongs to the account. */
export async function findOwnJob(db: Db, accountId: string, jobId: string): Promise<RenderJob | null> {
  const [row] = await db.select().from(renderJobs).where(and(eq(renderJobs.id, jobId), eq(renderJobs.accountId, accountId)));
  return row ?? null;
}

/**
 * Takes the oldest queued job and marks it rendering. The row is locked with `FOR UPDATE SKIP LOCKED`, so several
 * workers polling at once never take the same job: each skips the rows the others hold. Null when the queue is
 * empty.
 */
export async function claimNextJob(db: Db, now: Date): Promise<RenderJob | null> {
  return db.transaction(async (tx) => {
    const [next] = await tx
      .select({ id: renderJobs.id })
      .from(renderJobs)
      .where(eq(renderJobs.status, 'queued'))
      .orderBy(asc(renderJobs.createdAt), asc(renderJobs.id))
      .limit(1)
      .for('update', { skipLocked: true });
    if (!next) return null;
    const [row] = await tx.update(renderJobs).set({ status: 'rendering', startedAt: now }).where(eq(renderJobs.id, next.id)).returning();
    return row ?? null;
  });
}

export interface RenderOutcome {
  readonly outputBytes: number;
  readonly durationSeconds: number;
  readonly renderMs: number;
}

/** Marks a rendering job done. False when it is no longer rendering (marked stuck meanwhile): keep no file then. */
export async function markJobDone(db: Db, jobId: string, outcome: RenderOutcome, now: Date): Promise<boolean> {
  const rows = await db
    .update(renderJobs)
    .set({ status: 'done', finishedAt: now, ...outcome })
    .where(and(eq(renderJobs.id, jobId), eq(renderJobs.status, 'rendering')))
    .returning({ id: renderJobs.id });
  return rows.length > 0;
}

export async function markJobFailed(db: Db, jobId: string, error: string, now: Date): Promise<void> {
  await db
    .update(renderJobs)
    .set({ status: 'failed', error, finishedAt: now })
    .where(and(eq(renderJobs.id, jobId), eq(renderJobs.status, 'rendering')));
}

/** Puts a rendering job back in the queue (its worker is stopping); it is rendered again from the start. */
export async function requeueJob(db: Db, jobId: string): Promise<void> {
  await db
    .update(renderJobs)
    .set({ status: 'queued', startedAt: null })
    .where(and(eq(renderJobs.id, jobId), eq(renderJobs.status, 'rendering')));
}

/** Marks jobs rendering for longer than STUCK_AFTER_MS as failed (`stuck`); returns their ids. */
export async function failStuckJobs(db: Db, now: Date): Promise<string[]> {
  const rows = await db
    .update(renderJobs)
    .set({ status: 'failed', error: 'stuck', finishedAt: now })
    .where(and(eq(renderJobs.status, 'rendering'), lt(renderJobs.startedAt, new Date(now.getTime() - STUCK_AFTER_MS))))
    .returning({ id: renderJobs.id });
  return rows.map((r) => r.id);
}
