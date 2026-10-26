import type { Db, MediaLayout } from '@clip/db';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { authRoutes } from './auth/auth-routes';
import { requireAllowedOrigin } from './auth/origin-check';
import type { ServerConfig } from './config';
import { HttpError } from './http-error';
import { jobRoutes } from './jobs/job-routes';

export interface AppDeps {
  readonly config: ServerConfig;
  readonly db: Db;
  readonly media: MediaLayout;
}

export function createApp({ config, db, media }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  // nginx in front (one hop): req.ip is the visitor, for the rate limits.
  app.set('trust proxy', 'loopback');
  app.use(helmet({ contentSecurityPolicy: false }));

  app.get('/healthz', (_req, res) => {
    res.type('text/plain').send('ok');
  });

  app.use('/auth', rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(requireAllowedOrigin(config.allowedOrigins));
  app.use(authRoutes(config, db));
  app.use(jobRoutes(config, db, media));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not-found')));

  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.code, ...error.extra });
      return;
    }
    console.error('request failed', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'server-error' });
  };
  app.use(errors);
  return app;
}
