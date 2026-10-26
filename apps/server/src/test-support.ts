// Helpers for the server's tests: an app on a fresh in-memory database and a temporary media directory, and
// signed-in sessions made directly in the database (the IdP round trip has its own tests).
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mediaLayout, openPglite, type DbHandle, type MediaLayout } from '@clip/db';
import request from 'supertest';
import { createApp } from './app';
import { accountForSub, createSession, sessionCookieName } from './auth/session';
import { loadConfig, type ServerConfig } from './config';

export const ORIGIN = 'http://localhost:5293';

export interface TestApp {
  readonly config: ServerConfig;
  readonly handle: DbHandle;
  readonly media: MediaLayout;
  /** A supertest agent against the app served on 127.0.0.1 (not the IPv6 wildcard supertest picks by default). */
  http(): request.Agent;
  /** A signed-in account: its id and the Cookie header of its session. */
  signIn(sub: string): Promise<{ accountId: string; cookie: string }>;
  close(): Promise<void>;
}

export async function startTestApp(overrides: Partial<ServerConfig> = {}): Promise<TestApp> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'clip-test-'));
  const config: ServerConfig = { ...loadConfig({ NODE_ENV: 'test', MEDIA_DIR: dir }), ...overrides };
  const handle = await openPglite();
  const media = mediaLayout(dir);
  const server = createApp({ config, db: handle.db, media }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    config,
    handle,
    media,
    http: () => request.agent(`http://127.0.0.1:${port}`),
    async signIn(sub) {
      const now = new Date();
      const accountId = await accountForSub(handle.db, sub, now);
      const token = await createSession(handle.db, accountId, now);
      return { accountId, cookie: `${sessionCookieName(config)}=${token}` };
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await handle.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
