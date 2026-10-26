// The hourly retention run (systemd clip-media-cleanup): expired jobs, their files, expired sessions.
import { mediaLayout, openPostgres } from '@clip/db';
import { cleanup } from './cleanup';
import { loadWorkerConfig } from './config';

const config = loadWorkerConfig();
const database = await openPostgres(config.databaseUrl, { migrate: false });
try {
  const result = await cleanup(database.db, mediaLayout(config.mediaDir), new Date());
  console.log(`cleanup: ${result.jobs} expired job(s), ${result.sessions} session(s), ${result.orphanVideos} orphan video(s)`);
} finally {
  await database.close();
}
