import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import {
  checkJobAllowed,
  createJob,
  DAILY_RENDER_LIMIT,
  findOwnJob,
  isJobId,
  listJobs,
  nextVietnamDayStart,
  rendersToday,
  type CreateJobResult,
  type Db,
  type MediaLayout,
  type RenderJob,
} from '@clip/db';
import { MAX_PHOTOS, validateInput } from '@clip/templates';
import express, { type RequestHandler, type Router } from 'express';
import multer from 'multer';
import { accountOf, requireAccount } from '../auth/auth-routes';
import type { ServerConfig } from '../config';
import { HttpError } from '../http-error';
import { cleanPhoto, PhotoError, sniffPhotoType } from './photo-cleaning';

/** Largest photo accepted, before cleaning. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** Where nginx serves the videos from (an `internal` location aliasing MEDIA_DIR/videos/). */
export const ACCEL_VIDEO_PREFIX = '/_clip_media/videos/';

/** A job as the web app sees it. */
export interface JobView {
  readonly id: string;
  readonly templateId: string;
  readonly status: RenderJob['status'];
  readonly error: string | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
  readonly expiresAt: string;
  readonly expired: boolean;
  readonly durationSeconds: number | null;
}

export function jobView(job: RenderJob, now: Date): JobView {
  return {
    id: job.id,
    templateId: job.templateId,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    expiresAt: job.expiresAt.toISOString(),
    expired: job.expiresAt.getTime() <= now.getTime(),
    durationSeconds: job.durationSeconds,
  };
}

/** The refusal of a render request as an HTTP error: both limits are 429 with a code the UI explains. */
function refusal(result: Exclude<CreateJobResult, { ok: true }>): HttpError {
  return result.reason === 'daily-limit'
    ? new HttpError(429, 'daily-limit', { limit: DAILY_RENDER_LIMIT, resetAt: result.resetAt.toISOString() })
    : new HttpError(429, 'job-in-progress');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS, fields: 4, fieldSize: 8 * 1024, parts: MAX_PHOTOS + 4 },
});

/** Multer's limit errors as the API's codes. */
function uploadError(error: unknown): unknown {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') return new HttpError(413, 'photo-too-large');
  if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') return new HttpError(400, 'too-many-photos');
  return new HttpError(400, 'invalid-input');
}

/** The multipart body: up to three photos (in memory, 5 MB each) and the two text fields. */
const readUpload: RequestHandler = (req, res, next) => {
  upload.array('photos', MAX_PHOTOS)(req, res, (error: unknown) => (error ? next(uploadError(error)) : next()));
};

function parseFields(raw: unknown): unknown {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function jobRoutes(config: ServerConfig, db: Db, media: MediaLayout): Router {
  const router = express.Router();
  const signedIn = requireAccount(config, db);

  // Limits are checked before the upload is read, so a refused request costs no photo processing.
  const allowed: RequestHandler = async (_req, res, next) => {
    const refused = await checkJobAllowed(db, accountOf(res.locals), new Date());
    if (refused && !refused.ok) throw refusal(refused);
    next();
  };

  router.post('/api/jobs', signedIn, allowed, readUpload, async (req, res) => {
    const accountId = accountOf(res.locals);
    const body: unknown = req.body;
    const { templateId, fields } = typeof body === 'object' && body !== null ? (body as { templateId?: unknown; fields?: unknown }) : {};
    const files = Array.isArray(req.files) ? req.files : [];
    const input = validateInput(templateId, parseFields(fields), files.length);
    if (!input.ok) throw new HttpError(400, input.error, input.field ? { field: input.field } : {});
    if (files.some((file) => !sniffPhotoType(file.buffer))) throw new HttpError(400, 'photo-type');

    const jobId = randomUUID();
    try {
      for (const [index, file] of files.entries()) await cleanPhoto(file.buffer, media.tmp, media.photo(jobId, index));
      const now = new Date();
      const created = await createJob(db, { id: jobId, accountId, templateId: input.templateId, fields: { ...input.fields }, photoCount: files.length }, now);
      if (!created.ok) throw refusal(created);
      res.status(201).json({ job: jobView(created.job, now) });
    } catch (error) {
      await rm(media.inputDir(jobId), { recursive: true, force: true });
      if (error instanceof PhotoError) throw new HttpError(400, error.code);
      throw error;
    }
  });

  router.get('/api/jobs', signedIn, async (_req, res) => {
    const accountId = accountOf(res.locals);
    const now = new Date();
    const [jobs, used] = await Promise.all([listJobs(db, accountId), rendersToday(db, accountId, now)]);
    res.json({
      jobs: jobs.map((job) => jobView(job, now)),
      limits: { perDay: DAILY_RENDER_LIMIT, usedToday: used, resetAt: nextVietnamDayStart(now).toISOString() },
    });
  });

  /** A done, unexpired job of the account, or a 404/410. */
  async function ownVideo(accountId: string, id: string): Promise<RenderJob> {
    if (!isJobId(id)) throw new HttpError(404, 'not-found');
    const job = await findOwnJob(db, accountId, id);
    if (!job) throw new HttpError(404, 'not-found');
    if (job.status !== 'done') throw new HttpError(409, 'not-ready');
    if (job.expiresAt.getTime() <= Date.now()) throw new HttpError(410, 'expired');
    return job;
  }

  router.get('/api/jobs/:id', signedIn, async (req, res) => {
    const id = String(req.params.id);
    const job = isJobId(id) ? await findOwnJob(db, accountOf(res.locals), id) : null;
    if (!job) throw new HttpError(404, 'not-found');
    res.json({ job: jobView(job, new Date()) });
  });

  // `video` plays in the page, `download` saves the file. The ownership check is here; the bytes come from nginx.
  for (const kind of ['video', 'download'] as const) {
    router.get(`/api/jobs/:id/${kind}`, signedIn, async (req, res) => {
      const job = await ownVideo(accountOf(res.locals), String(req.params.id));
      const name = `clip-${job.createdAt.toISOString().slice(0, 10)}-${job.id.slice(0, 8)}.mp4`;
      res.set('Content-Type', 'video/mp4');
      res.set('Content-Disposition', `${kind === 'download' ? 'attachment' : 'inline'}; filename="${name}"`);
      res.set('Cache-Control', 'private, no-store');
      if (config.videoDelivery === 'accel') {
        res.set('X-Accel-Redirect', `${ACCEL_VIDEO_PREFIX}${job.id}.mp4`).end();
        return;
      }
      res.sendFile(media.video(job.id), (error) => {
        if (error && !res.headersSent) res.status(404).json({ error: 'not-found' });
      });
    });
  }

  return router;
}
