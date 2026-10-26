import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { accounts, mediaLayout, openPglite, renderJobs, sessions, type DbHandle, type MediaLayout } from '@clip/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup } from './cleanup';

let handle: DbHandle;
let media: MediaLayout;
let dir: string;

beforeEach(async () => {
  handle = await openPglite();
  dir = await mkdtemp(path.join(os.tmpdir(), 'clip-cleanup-'));
  media = mediaLayout(dir);
  await mkdir(media.videos, { recursive: true });
});
afterEach(async () => {
  await handle.close();
  await rm(dir, { recursive: true, force: true });
});

const NOW = new Date('2026-11-02T03:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

async function doneJob(accountId: string, expiresAt: Date): Promise<string> {
  const id = randomUUID();
  await handle.db.insert(renderJobs).values({
    id,
    accountId,
    templateId: 'trich-dan',
    fields: { quote: 'riêng tư' },
    photoCount: 0,
    status: 'done',
    createdAt: new Date(expiresAt.getTime() - 7 * DAY),
    expiresAt,
  });
  await writeFile(media.video(id), 'mp4');
  return id;
}

describe('retention cleanup', () => {
  it('deletes jobs at their expiry with their video, expired sessions and videos no job owns', async () => {
    const [account] = await handle.db.insert(accounts).values({ sub: 's', createdAt: NOW }).returning();
    if (!account) throw new Error('no account');
    const expired = await doneJob(account.id, new Date(NOW.getTime() - 1));
    const live = await doneJob(account.id, new Date(NOW.getTime() + DAY));
    const orphan = randomUUID();
    await writeFile(media.video(orphan), 'mp4');
    await handle.db.insert(sessions).values([
      { id: 'old', accountId: account.id, createdAt: NOW, lastSeenAt: NOW, expiresAt: new Date(NOW.getTime() - 1) },
      { id: 'idle', accountId: account.id, createdAt: NOW, lastSeenAt: new Date(NOW.getTime() - 8 * DAY), expiresAt: new Date(NOW.getTime() + DAY) },
      { id: 'live', accountId: account.id, createdAt: NOW, lastSeenAt: NOW, expiresAt: new Date(NOW.getTime() + DAY) },
    ]);

    expect(await cleanup(handle.db, media, NOW)).toEqual({ jobs: 1, sessions: 2, orphanVideos: 1 });
    expect((await handle.db.select().from(renderJobs)).map((j) => j.id)).toEqual([live]);
    expect((await handle.db.select().from(sessions)).map((s) => s.id)).toEqual(['live']);
    expect(await readdir(media.videos)).toEqual([`${live}.mp4`]);
    expect(expired).not.toBe(live);
  });
});
