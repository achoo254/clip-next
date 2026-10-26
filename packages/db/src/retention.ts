import { inArray, lt, lte, or } from 'drizzle-orm';
import type { Db } from './client';
import { renderJobs, sessions } from './schema';

/** A session lasts at most this long, and ends after this long unused. */
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

export interface Purged {
  /** Jobs deleted (their video and photos are deleted by the caller, by these ids). */
  readonly jobIds: readonly string[];
  readonly sessions: number;
}

/**
 * Deletes what the privacy page promises to delete: jobs (with the person's text) at their expiry, 7 days after
 * they were made, and sessions that expired or went unused for SESSION_IDLE_MS.
 */
export async function purgeExpired(db: Db, now: Date): Promise<Purged> {
  const jobs = await db.delete(renderJobs).where(lte(renderJobs.expiresAt, now)).returning({ id: renderJobs.id });
  const gone = await db
    .delete(sessions)
    .where(or(lte(sessions.expiresAt, now), lt(sessions.lastSeenAt, new Date(now.getTime() - SESSION_IDLE_MS))))
    .returning({ id: sessions.id });
  return { jobIds: jobs.map((j) => j.id), sessions: gone.length };
}

/** Which of `ids` still have a job row (a video file without one is left over and can go). */
export async function existingJobIds(db: Db, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db.select({ id: renderJobs.id }).from(renderJobs).where(inArray(renderJobs.id, [...ids]));
  return new Set(rows.map((r) => r.id));
}
