/**
 * An account deleted at the IdP (auth-next ADR 0018, POST /api/idp/account-deleted): which notices are taken, that
 * everything of the account goes (rows and files) while other accounts keep theirs, and that a repeated notice is a
 * no-op.
 */
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { accounts, createJob, renderJobs, sessions } from '@clip/db';
import { eq } from 'drizzle-orm';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { startTestApp, type TestApp } from '../test-support';
import { ACCOUNT_DELETED_PATH } from './account-deleted';

const SECRET = 's'.repeat(40);
const KID = 'fake-key-1';
const b64url = (value: Buffer | string): string => Buffer.from(value).toString('base64url');

interface NoticeOptions {
  readonly claims?: Record<string, unknown>;
  readonly how?: 'valid' | 'stranger';
  readonly typ?: string;
}

/** A stand-in for auth.hoandat.com that publishes an ES256 key and signs account-deletion SETs with it. */
async function startFakeIdp(): Promise<{ issuer: string; notice(sub: string, audience: string, options?: NoticeOptions): string; close(): Promise<void> }> {
  const key = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const stranger = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const app = express();
  let issuer = '';
  app.get('/.well-known/openid-configuration', (_req, res) => {
    res.json({ issuer, authorization_endpoint: `${issuer}/auth`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` });
  });
  app.get('/jwks', (_req, res) => {
    res.json({ keys: [{ ...key.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256', use: 'sig' }] });
  });
  const server: Server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    issuer,
    notice(sub, audience, { claims = {}, how = 'valid', typ = 'secevent+jwt' } = {}) {
      const now = Math.floor(Date.now() / 1000);
      const payload = { iss: issuer, aud: audience, sub, iat: now, exp: now + 600, jti: randomUUID(), toe: now, events: { 'urn:hoandat:auth:event:account.deleted': {} }, ...claims };
      const head = b64url(JSON.stringify({ alg: 'ES256', kid: KID, typ }));
      const body = b64url(JSON.stringify(payload));
      const signature = sign('sha256', Buffer.from(`${head}.${body}`), { key: (how === 'valid' ? key : stranger).privateKey, dsaEncoding: 'ieee-p1363' });
      return `${head}.${body}.${b64url(signature)}`;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

let idp: Awaited<ReturnType<typeof startFakeIdp>>;
let app: TestApp;

beforeAll(async () => {
  idp = await startFakeIdp();
  app = await startTestApp({ auth: loadConfig({ NODE_ENV: 'test', AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET }).auth });
});
afterAll(async () => {
  await app.close();
  await idp.close();
});

const receiver = (): string => `${app.config.publicUrl}${ACCOUNT_DELETED_PATH}`;
const noticeFor = (sub: string, options?: NoticeOptions): string => idp.notice(sub, receiver(), options);
/** The IdP's POST: server to server, no Origin, no cookie. */
const notify = (body: string, type = 'application/secevent+jwt') => app.http().post(ACCOUNT_DELETED_PATH).set('Content-Type', type).send(body);
const exists = (file: string): Promise<boolean> =>
  stat(file).then(
    () => true,
    () => false,
  );

/** A signed-in account with a finished job (video on disk) and a queued one (photos on disk). */
async function accountWithData(sub: string) {
  const { accountId, cookie } = await app.signIn(sub);
  const ids: string[] = [];
  for (const status of ['done', 'queued'] as const) {
    const created = await createJob(app.handle.db, { id: randomUUID(), accountId, templateId: 'trich-dan', fields: { quote: 'Chữ riêng' }, photoCount: 1 }, new Date());
    if (!created.ok) throw new Error('job refused');
    if (status === 'done') await app.handle.db.update(renderJobs).set({ status: 'done' }).where(eq(renderJobs.id, created.job.id));
    ids.push(created.job.id);
  }
  const [done = '', queued = ''] = ids;
  await mkdir(app.media.videos, { recursive: true });
  await writeFile(app.media.video(done), 'mp4');
  await mkdir(app.media.inputDir(queued), { recursive: true });
  await writeFile(app.media.photo(queued, 0), 'jpg');
  return { accountId, cookie, done, queued };
}

describe('POST /api/idp/account-deleted: which notices are taken', () => {
  const nowS = (): number => Math.floor(Date.now() / 1000);

  it.each([
    ['a key the IdP never published', () => noticeFor('careful', { how: 'stranger' })],
    ['another receiver', () => noticeFor('careful', { claims: { aud: 'https://chat.hoandat.com/api/idp/account-deleted' } })],
    ['an audience list', () => noticeFor('careful', { claims: { aud: [receiver()] } })],
    ['another issuer', () => noticeFor('careful', { claims: { iss: 'https://evil.example' } })],
    ['an expired notice', () => noticeFor('careful', { claims: { iat: nowS() - 1200, exp: nowS() - 600 } })],
    ['no expiry', () => noticeFor('careful', { claims: { exp: undefined } })],
    ['another event', () => noticeFor('careful', { claims: { events: { 'urn:hoandat:auth:event:account.created': {} } } })],
    ['no sub', () => noticeFor('')],
  ])('refuses %s with 401 and deletes nothing', async (_label, makeToken) => {
    const { cookie } = await app.signIn('careful');
    expect((await notify(makeToken())).status).toBe(401);
    expect((await app.http().get('/api/me').set('Cookie', cookie)).body).toMatchObject({ signedIn: true });
  });

  it('refuses a token signed with another algorithm than ES256', async () => {
    const { cookie } = await app.signIn('careful');
    const [, payload = '', signature = ''] = noticeFor('careful').split('.');
    const forged = `${b64url(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'secevent+jwt' }))}.${payload}.${signature}`;
    expect((await notify(forged)).status).toBe(401);
    expect((await app.http().get('/api/me').set('Cookie', cookie)).body).toMatchObject({ signedIn: true });
  });

  it.each([
    ['an empty body', () => ''],
    ['not a JWS', () => 'hello'],
    ['another token type (a logout token)', () => noticeFor('careful', { typ: 'logout+jwt' })],
  ])('answers 400 to %s', async (_label, makeBody) => {
    expect((await notify(makeBody())).status).toBe(400);
  });

  it('answers 400 to a SET sent as another media type', async () => {
    expect((await notify(noticeFor('careful'), 'application/json')).status).toBe(400);
  });

  it('answers 202 to an account this app never saw', async () => {
    expect((await notify(noticeFor('never-signed-in'))).status).toBe(202);
  });

  it('answers 503 while sign-in is off (no IdP to check against), so the IdP retries', async () => {
    const off = await startTestApp();
    try {
      const res = await off.http().post(ACCOUNT_DELETED_PATH).set('Content-Type', 'application/secevent+jwt').send(noticeFor('careful'));
      expect(res.status).toBe(503);
    } finally {
      await off.close();
    }
  });
});

describe('POST /api/idp/account-deleted: what goes', () => {
  it('deletes the account, its sessions, its jobs and their files, and leaves other accounts alone', async () => {
    const db = app.handle.db;
    const leaver = await accountWithData('leaver');
    const other = await accountWithData('stays');

    expect((await notify(noticeFor('leaver'))).status).toBe(202);

    expect(await db.select().from(accounts).where(eq(accounts.id, leaver.accountId))).toEqual([]);
    expect(await db.select().from(sessions).where(eq(sessions.accountId, leaver.accountId))).toEqual([]);
    expect(await db.select().from(renderJobs).where(eq(renderJobs.accountId, leaver.accountId))).toEqual([]);
    expect(await exists(app.media.video(leaver.done))).toBe(false);
    expect(await exists(app.media.inputDir(leaver.queued))).toBe(false);
    expect((await app.http().get('/api/me').set('Cookie', leaver.cookie)).body).toMatchObject({ signedIn: false });

    expect(await db.select({ id: renderJobs.id }).from(renderJobs).where(eq(renderJobs.accountId, other.accountId))).toHaveLength(2);
    expect(await exists(app.media.video(other.done))).toBe(true);
    expect(await exists(app.media.photo(other.queued, 0))).toBe(true);
    expect((await app.http().get('/api/me').set('Cookie', other.cookie)).body).toMatchObject({ signedIn: true });
  });

  it('takes the same notice again (the IdP retries) without changing anything', async () => {
    await accountWithData('twice');
    const notice = noticeFor('twice');
    expect((await notify(notice)).status).toBe(202);
    expect((await notify(notice)).status).toBe(202);
    expect(await app.handle.db.select().from(accounts).where(eq(accounts.sub, 'twice'))).toEqual([]);
  });
});
