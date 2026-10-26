import { mkdir } from 'node:fs/promises';
import { mediaLayout, openPglite, openPostgres } from '@clip/db';
import { RENDER_TIMEOUT_MS, renderVideo, startWorker, type RunningWorker } from '@clip/worker';
import { createApp } from './app';
import { DEV_PGLITE_DIR, loadConfig } from './config';

const config = loadConfig();
const media = mediaLayout(config.mediaDir);
await mkdir(media.tmp, { recursive: true });
await mkdir(media.videos, { recursive: true });
const database = config.databaseUrl ? await openPostgres(config.databaseUrl, { migrate: true }) : await openPglite(DEV_PGLITE_DIR);
console.log(config.databaseUrl ? 'database: Postgres (DATABASE_URL)' : `database: PGlite at ${DEV_PGLITE_DIR}`);

// PGlite belongs to one process, so without Postgres (dev) the render worker runs in here; in production it is
// its own service (clip-worker) with its own memory and CPU limits.
let worker: RunningWorker | null = null;
if (!config.databaseUrl) {
  worker = startWorker({
    db: database.db,
    media,
    pollMs: 2_000,
    log: { info: (m) => console.log(`[worker] ${m}`), warn: (m) => console.warn(`[worker] ${m}`) },
    render: (input, signal) => renderVideo(input, { chromePath: config.chromePath, timeoutMs: RENDER_TIMEOUT_MS, signal }),
  });
  console.log('render worker running in-process (no DATABASE_URL)');
}

const app = createApp({ config, db: database.db, media });
// Loopback only: nginx (production) or the Vite dev server (dev) is in front.
const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`clip server on 127.0.0.1:${config.port} (${config.nodeEnv}); sign-in ${config.auth ? 'on' : 'off (no AUTH_CLIENT_SECRET)'}`);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`${signal}: stopping`);
  server.close();
  await worker?.stop();
  await database.close();
  process.exit(0);
}
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => void shutdown(signal));
