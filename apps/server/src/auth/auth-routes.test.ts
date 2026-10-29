import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { startTestApp, type TestApp } from '../test-support';
import { codeChallenge } from './oidc-login';

const SECRET = 's'.repeat(40);
const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

interface FakeIdp {
  readonly issuer: string;
  /** The token requests it received (Authorization header and form). */
  readonly tokenRequests: { authorization: string | undefined; form: Record<string, string> }[];
  /** Nonce of the ID token it hands out. */
  nonce: string;
  /** Authorization headers the userinfo endpoint received. */
  readonly userinfoRequests: (string | undefined)[];
  /** What userinfo answers: a JSON body, or an HTTP error status. */
  userinfo: Record<string, unknown> | number;
  close(): Promise<void>;
}

const ACCESS_TOKEN = 'access-token-1';

/**
 * A local stand-in for auth.hoandat.com: discovery, a token endpoint and userinfo (http is allowed on loopback
 * outside production).
 */
async function startFakeIdp(): Promise<FakeIdp> {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  const idp: Omit<FakeIdp, 'close'> & { issuer: string } = {
    issuer: '',
    nonce: '',
    tokenRequests: [],
    userinfoRequests: [],
    userinfo: { sub: 'account-42', name: 'Lan  Anh', picture: 'https://lh3.googleusercontent.com/a/abc', email: 'lan@example.com' },
  };
  app.get('/.well-known/openid-configuration', (_req, res) => {
    res.json({ issuer: idp.issuer, authorization_endpoint: `${idp.issuer}/auth`, token_endpoint: `${idp.issuer}/token`, userinfo_endpoint: `${idp.issuer}/me` });
  });
  app.post('/token', (req, res) => {
    idp.tokenRequests.push({ authorization: req.headers.authorization, form: req.body as Record<string, string> });
    const claims = { iss: idp.issuer, aud: 'clip-web', exp: Math.floor(Date.now() / 1000) + 300, nonce: idp.nonce, sub: 'account-42' };
    res.json({ id_token: `${b64({ alg: 'RS256' })}.${b64(claims)}.sig`, access_token: ACCESS_TOKEN, token_type: 'Bearer' });
  });
  app.get('/me', (req, res) => {
    idp.userinfoRequests.push(req.headers.authorization);
    if (typeof idp.userinfo === 'number') res.status(idp.userinfo).json({ error: 'invalid_token' });
    else res.json(idp.userinfo);
  });
  const server: Server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  idp.issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return Object.assign(idp, { close: () => new Promise<void>((resolve) => server.close(() => resolve())) });
}

let app: TestApp | null = null;
let idp: FakeIdp | null = null;
afterEach(async () => {
  await app?.close();
  await idp?.close();
});

describe('sign-in with the account service', () => {
  it('runs Code + PKCE with client_secret_basic and opens a session, back on the page it started from', async () => {
    idp = await startFakeIdp();
    const base = loadConfig({ NODE_ENV: 'test', AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET, PUBLIC_URL: 'http://localhost:5293' });
    app = await startTestApp({ auth: base.auth });
    const http = app.http();

    const login = await http.get('/auth/login?return=/video&lang=en');
    expect(login.status).toBe(302);
    const authorize = new URL(login.headers.location ?? '');
    expect(authorize.origin + authorize.pathname).toBe(`${idp.issuer}/auth`);
    const q = authorize.searchParams;
    expect(Object.fromEntries([...q].filter(([k]) => ['client_id', 'redirect_uri', 'response_type', 'scope', 'code_challenge_method', 'ui_locales'].includes(k)))).toEqual({
      client_id: 'clip-web',
      redirect_uri: 'http://localhost:5293/auth/callback',
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge_method: 'S256',
      ui_locales: 'en',
    });
    idp.nonce = q.get('nonce') ?? '';

    // A callback with another state is refused (back on the page it started from, with the failure noted).
    expect((await http.get('/auth/callback?state=wrong&code=c1')).headers.location).toBe('/video?login=fail');
    expect(idp.tokenRequests).toHaveLength(0);
    // The refused attempt cleared the state cookie: start again.
    const again = new URL((await http.get('/auth/login?return=/video&lang=en')).headers.location ?? '');
    idp.nonce = again.searchParams.get('nonce') ?? '';
    const callback = await http.get(`/auth/callback?state=${again.searchParams.get('state') ?? ''}&code=c1`);
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('/video');

    const [request] = idp.tokenRequests;
    expect(request?.authorization).toBe(`Basic ${Buffer.from(`clip-web:${SECRET}`).toString('base64')}`);
    expect(request?.form.grant_type).toBe('authorization_code');
    expect(codeChallenge(request?.form.code_verifier ?? '')).toBe(again.searchParams.get('code_challenge'));
    expect(idp.userinfoRequests).toEqual([`Bearer ${ACCESS_TOKEN}`]);
    expect((await http.get('/api/me')).body).toEqual({
      signedIn: true,
      signInAvailable: true,
      name: 'Lan Anh',
      picture: 'https://lh3.googleusercontent.com/a/abc',
      email: 'lan@example.com',
    });

    expect((await http.post('/auth/logout').set('Origin', 'http://localhost:5293')).status).toBe(204);
    expect((await http.get('/api/me')).body).toEqual({ signedIn: false, signInAvailable: true, name: null, picture: null, email: null });
  });

  it('refreshes the profile at each sign-in and keeps it when userinfo fails', async () => {
    idp = await startFakeIdp();
    const base = loadConfig({ NODE_ENV: 'test', AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET, PUBLIC_URL: 'http://localhost:5293' });
    app = await startTestApp({ auth: base.auth });
    const fakeIdp = idp;
    const http = app.http();
    const signIn = async (): Promise<string | undefined> => {
      const authorize = new URL((await http.get('/auth/login?return=/')).headers.location ?? '');
      fakeIdp.nonce = authorize.searchParams.get('nonce') ?? '';
      return (await http.get(`/auth/callback?state=${authorize.searchParams.get('state') ?? ''}&code=c1`)).headers.location;
    };

    expect(await signIn()).toBe('/');
    expect((await http.get('/api/me')).body.name).toBe('Lan Anh');

    // The IdP now has no picture and a non-https one would be dropped anyway; the stored profile follows.
    idp.userinfo = { sub: 'account-42', preferred_username: 'lananh', picture: 'http://example.com/a.png' };
    expect(await signIn()).toBe('/');
    expect((await http.get('/api/me')).body).toMatchObject({ signedIn: true, name: 'lananh', picture: null, email: null });

    // Userinfo down, or answering for another subject: sign-in still works and the stored profile stays.
    idp.userinfo = 503;
    expect(await signIn()).toBe('/');
    expect((await http.get('/api/me')).body).toMatchObject({ signedIn: true, name: 'lananh' });
    idp.userinfo = { sub: 'someone-else', name: 'Mallory' };
    expect(await signIn()).toBe('/');
    expect((await http.get('/api/me')).body).toMatchObject({ signedIn: true, name: 'lananh' });
  });
});
