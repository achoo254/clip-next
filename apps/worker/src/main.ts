// The render worker (systemd clip-worker): one job at a time from the Postgres queue.
import { mkdir } from 'node:fs/promises';
import { mediaLayout, openPostgres } from '@clip/db';
import { loadWorkerConfig, RENDER_TIMEOUT_MS } from './config';
import { renderVideo } from './render';
import { startWorker } from './worker-loop';

const config = loadWorkerConfig();
const media = mediaLayout(config.mediaDir);
await mkdir(media.tmp, { recursive: true });
await mkdir(media.videos, { recursive: true });
// The server owns the schema (it migrates on start); the worker only reads and updates jobs.
const database = await openPostgres(config.databaseUrl, { migrate: false });
const log = { info: (m: string) => console.log(m), warn: (m: string) => console.warn(m) };
const worker = startWorker({
  db: database.db,
  media,
  pollMs: config.pollMs,
  log,
  render: (input) => renderVideo(input, { chromePath: config.chromePath, timeoutMs: RENDER_TIMEOUT_MS }),
});
console.log(`clip worker polling every ${config.pollMs} ms; chrome: ${config.chromePath ?? 'hyperframes default'}`);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  // systemd waits TimeoutStopSec for the job in hand; a job cut short is failed later as stuck.
  console.log(`${signal}: finishing the current job`);
  await worker.stop();
  await database.close();
  process.exit(0);
}
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => void shutdown(signal));
