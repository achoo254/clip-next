/**
 * `POST /api/idp/account-deleted` (auth-next ADR 0018): an account was deleted at auth.hoandat.com/account, the only
 * place an account is deleted, so everything Clip stored for it goes too, at once: the account (name, picture,
 * email), its sessions, its jobs (the text it typed) and their videos and photos on disk. Nothing in Clip is shared
 * between accounts, so nothing is handed over or kept. The IdP calls it server to server with a signed Security Event
 * Token as the body (`Content-Type: application/secevent+jwt`) and no Origin, so app.ts mounts it ahead of the
 * same-origin check.
 *
 * Answers 202 once the data is deleted, or when no account here has that `sub` (never signed in, or already deleted:
 * a retried notice is a no-op); 400 when the body is not a SET; 401 when the SET is not a valid one from our IdP for
 * this URL (alg, signature, iss, aud, exp, event, sub); 503 when sign-in is off, the IdP's keys cannot be read or the
 * deletion failed, so the IdP retries. Neither the SET nor the `sub` is logged, only the internal account id.
 */
import { rm } from 'node:fs/promises';
import { deleteAccountData, type Db, type MediaLayout } from '@clip/db';
import express, { type Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { ServerConfig } from '../config';
import { discoveryCache } from './auth-routes';
import { decodeJws, idpSignature, type DecodedJws } from './idp-signature';

export const ACCOUNT_DELETED_PATH = '/api/idp/account-deleted';
export const ACCOUNT_DELETED_EVENT = 'urn:hoandat:auth:event:account.deleted';
const SET_MEDIA_TYPE = 'application/secevent+jwt';
const SET_TYPES = new Set(['secevent+jwt', 'application/secevent+jwt']);
/** Tolerance for clock differences between the IdP and this server. */
const CLOCK_SKEW_S = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether a JWS presents itself as a SET (its `typ`, compared without case as RFC 7515 §4.1.9 allows). */
export function isSecurityEventToken(jws: DecodedJws): boolean {
  const { typ } = jws.header;
  return typeof typ === 'string' && SET_TYPES.has(typ.toLowerCase());
}

/** The deleted account's `sub` when the claims of a signature-checked SET are right for `expect`; null otherwise. */
export function deletedSub(claims: Record<string, unknown>, expect: { issuer: string; audience: string }, nowMs: number): string | null {
  if (claims.iss !== expect.issuer || claims.aud !== expect.audience) return null;
  const nowS = Math.floor(nowMs / 1000);
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S <= nowS) return null;
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > nowS) return null;
  if (!isRecord(claims.events) || !isRecord(claims.events[ACCOUNT_DELETED_EVENT])) return null;
  return typeof claims.sub === 'string' && claims.sub !== '' ? claims.sub : null;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function accountDeletedRoute(config: ServerConfig, db: Db, media: MediaLayout, now: () => number = Date.now): Router {
  const router = express.Router();
  const auth = config.auth;
  const signature = auth ? idpSignature(auth.issuer, discoveryCache(auth.issuer), now) : null;
  const audience = `${config.publicUrl}${ACCOUNT_DELETED_PATH}`;
  // The IdP calls from one address and retries with backoff: a refused notice is only delayed.
  const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req, res) => res.status(429).end() });

  router.post(ACCOUNT_DELETED_PATH, limiter, express.text({ type: SET_MEDIA_TYPE, limit: '8kb' }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const body: unknown = req.body;
    const jws = typeof body === 'string' ? decodeJws(body.trim()) : null;
    if (!jws || !isSecurityEventToken(jws)) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    if (!auth || !signature) {
      // Sign-in is off here: no IdP to check the signature against. The IdP keeps the notice and retries.
      res.status(503).end();
      return;
    }
    if (jws.header.alg !== 'ES256') {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    let sub: string | null;
    try {
      const payload = await signature.verifiedPayload(jws);
      sub = payload ? deletedSub(payload, { issuer: auth.issuer, audience }, now()) : null;
    } catch (error) {
      console.warn('account deletion notice: IdP keys unavailable', errorText(error));
      res.status(503).end();
      return;
    }
    if (!sub) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    let deleted: Awaited<ReturnType<typeof deleteAccountData>>;
    try {
      deleted = await deleteAccountData(db, sub);
    } catch (error) {
      console.error('account deletion notice: deletion failed', errorText(error));
      res.status(503).end();
      return;
    }
    if (!deleted) {
      console.info('account deletion notice: no account here');
      res.status(202).end();
      return;
    }
    // The rows are gone; their files follow. A file left behind (a render finishing right now) is an orphan the hourly
    // cleanup removes, so a failure here never undoes the deletion.
    for (const id of deleted.jobIds) {
      await Promise.all([rm(media.video(id), { force: true }), rm(media.inputDir(id), { recursive: true, force: true })]).catch((error: unknown) =>
        console.error('account deletion notice: job files not removed', id, errorText(error)),
      );
    }
    console.info('account deletion notice: account deleted', deleted.accountId, deleted.jobIds.length);
    res.status(202).end();
  });

  return router;
}
