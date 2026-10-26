import { z } from 'zod';

const emptyIsUnset = (value: unknown): unknown => (value === '' ? undefined : value);

const Env = z.object({
  DATABASE_URL: z.url(),
  MEDIA_DIR: z.string().min(1),
  /** Chrome for the renders (on the server: /usr/bin/google-chrome). Unset: hyperframes finds or downloads one. */
  CHROME_PATH: z.preprocess(emptyIsUnset, z.string().min(1).optional()),
  POLL_MS: z.coerce.number().int().min(200).max(60_000).default(2_000),
});

export interface WorkerConfig {
  readonly databaseUrl: string;
  readonly mediaDir: string;
  readonly chromePath: string | undefined;
  readonly pollMs: number;
}

/** Validates the worker's env once at start; throws naming the offending keys. */
export function loadWorkerConfig(env: Record<string, string | undefined> = process.env): WorkerConfig {
  const parsed = Env.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid worker env: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  const e = parsed.data;
  return { databaseUrl: e.DATABASE_URL, mediaDir: e.MEDIA_DIR, chromePath: e.CHROME_PATH, pollMs: e.POLL_MS };
}

/** Longest a render may take before it is killed: under the 10 minutes after which a job counts as stuck. */
export const RENDER_TIMEOUT_MS = 9 * 60 * 1000;
