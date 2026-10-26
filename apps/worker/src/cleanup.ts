/**
 * Retention: deletes expired jobs (the person's text) with their video and photos, expired sessions, and video
 * files no job owns any more. Videos go at their job's expiry date, not by file age. Pure logic; `cleanup-main.ts`
 * runs it from the hourly systemd timer.
 */
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { existingJobIds, isJobId, purgeExpired, type Db, type MediaLayout } from '@clip/db';

export interface CleanupResult {
  readonly jobs: number;
  readonly sessions: number;
  readonly orphanVideos: number;
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

export async function cleanup(db: Db, media: MediaLayout, now: Date): Promise<CleanupResult> {
  const purged = await purgeExpired(db, now);
  for (const id of purged.jobIds) {
    await rm(media.video(id), { force: true });
    await rm(media.inputDir(id), { recursive: true, force: true });
  }
  // A video whose job row is gone (deleted above in an earlier run that failed half-way, or dropped) is removed too.
  const files = (await listDir(media.videos)).filter((name) => name.endsWith('.mp4') && isJobId(name.slice(0, -4)));
  const owned = await existingJobIds(
    db,
    files.map((name) => name.slice(0, -4)),
  );
  const orphans = files.filter((name) => !owned.has(name.slice(0, -4)));
  for (const name of orphans) await rm(path.join(media.videos, name), { force: true });
  return { jobs: purged.jobIds.length, sessions: purged.sessions, orphanVideos: orphans.length };
}
