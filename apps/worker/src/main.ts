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
  render: (input, signal) => renderVideo(input, { chromePath: config.chromePath, timeoutMs: RENDER_TIMEOUT_MS, signal }),
  // A render that timed out may have left Chrome behind (it runs in a process group of its own): exit, and systemd
  // (KillMode=mixed, Restart=on-failure) kills whatever is left in the cgroup and starts a clean worker.
  onTimeout: () => {
    console.warn('render timed out: exiting so systemd clears the cgroup');
    void database.close().finally(() => process.exit(1));
  },
});
console.log(`clip worker polling every ${config.pollMs} ms; chrome: ${config.chromePath ?? 'hyperframes default'}`);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  // The job in hand is aborted (its tools get SIGTERM, then SIGKILL after a grace period) and put back in the queue;
  // the next worker renders it again from the start. systemd waits TimeoutStopSec for this.
  console.log(`${signal}: putting the current job back in the queue`);
  await worker.stop();
  await database.close();
  process.exit(0);
}
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => void shutdown(signal));
