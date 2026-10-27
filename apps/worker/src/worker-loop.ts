import { rm } from 'node:fs/promises';
import path from 'node:path';
import { claimNextJob, failStuckJobs, markJobDone, markJobFailed, requeueJob, type Db, type MediaLayout, type RenderJob } from '@clip/db';
import { compositionVariables, isTemplateId, parseBackground, parseFormat, templateById } from '@clip/templates';
import { RenderError, type RenderInput, type RenderResult } from './render';

/** Renders one job's video; `renderVideo` in production, injectable for tests of the queue. */
export type Renderer = (input: RenderInput, signal: AbortSignal) => Promise<RenderResult>;

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

export interface WorkerDeps {
  readonly db: Db;
  readonly media: MediaLayout;
  readonly render: Renderer;
  readonly now?: () => Date;
  readonly log: Logger;
  /** Aborted when the worker stops: the job in hand goes back to the queue. */
  readonly signal?: AbortSignal;
  /**
   * Called after a render timed out (the job is already failed). The service exits here, so systemd removes
   * everything the render left in its cgroup (a hung Chrome included).
   */
  readonly onTimeout?: () => void;
}

export type JobOutcome = 'idle' | 'done' | 'failed' | 'requeued';

/**
 * The render input of a job: its fields, background and photos as composition variables, photos copied as `photos/…`,
 * and its format.
 */
export function renderInputFor(job: RenderJob, media: MediaLayout): RenderInput {
  if (!isTemplateId(job.templateId)) throw new RenderError('render-failed', `unknown template ${job.templateId}`);
  const spec = templateById(job.templateId);
  const background = parseBackground(spec, job.background);
  if (background === null) throw new RenderError('render-failed', `background ${job.background} not in ${job.templateId}`);
  const format = parseFormat(job.format);
  if (format === null) throw new RenderError('render-failed', `unknown format ${job.format}`);
  const photos = Array.from({ length: job.photoCount }, (_, index) => media.photo(job.id, index));
  const variables = compositionVariables(
    spec,
    job.fields,
    photos.map((file) => `photos/${path.basename(file)}`),
    background,
  );
  return { templateId: job.templateId, format, variables, photos, workDir: path.join(media.tmp, `render-${job.id}`), output: media.video(job.id) };
}

/**
 * One turn of the worker: fails jobs stuck in `rendering`, then claims the oldest queued job and renders it. The
 * job's photos are deleted afterwards, unless the worker is stopping: then the job goes back to the queue with them.
 */
export async function processNextJob(deps: WorkerDeps): Promise<JobOutcome> {
  const now = deps.now ?? (() => new Date());
  const stuck = await failStuckJobs(deps.db, now());
  for (const id of stuck) deps.log.warn(`job ${id} was rendering too long: marked failed`);
  if (deps.signal?.aborted) return 'idle';
  const job = await claimNextJob(deps.db, now());
  if (!job) return 'idle';
  deps.log.info(`job ${job.id} rendering (${job.templateId}, ${job.photoCount} photo(s))`);
  let outcome: JobOutcome;
  let timedOut = false;
  try {
    const result = await deps.render(renderInputFor(job, deps.media), deps.signal ?? new AbortController().signal);
    const kept = await markJobDone(deps.db, job.id, { outputBytes: result.bytes, durationSeconds: result.durationSeconds, renderMs: result.renderMs }, now());
    if (kept) {
      deps.log.info(`job ${job.id} done in ${result.renderMs} ms (${result.durationSeconds} s video, ${result.bytes} bytes)`);
      outcome = 'done';
    } else {
      // Marked stuck while this render ran long: the job is failed for the user, so its file must not linger.
      await rm(deps.media.video(job.id), { force: true });
      deps.log.warn(`job ${job.id} finished after it was marked failed: video removed`);
      outcome = 'failed';
    }
  } catch (error) {
    const code = error instanceof RenderError ? error.code : 'render-failed';
    if (code === 'aborted') {
      // The worker is stopping (a release, a restart): the job is rendered again from scratch after it.
      await requeueJob(deps.db, job.id);
      deps.log.info(`job ${job.id} put back in the queue: the worker is stopping`);
      return 'requeued';
    }
    const detail = error instanceof RenderError ? error.detail : error instanceof Error ? error.message : String(error);
    deps.log.warn(`job ${job.id} failed: ${code}: ${detail}`);
    await markJobFailed(deps.db, job.id, code, now());
    timedOut = code === 'timeout';
    outcome = 'failed';
  }
  await rm(deps.media.inputDir(job.id), { recursive: true, force: true });
  if (timedOut) deps.onTimeout?.();
  return outcome;
}

export interface RunningWorker {
  /** Stops polling; the job in hand is aborted and put back in the queue. Resolves once that is done. */
  stop(): Promise<void>;
}

/** Polls the queue every `pollMs`, one job at a time; right after a job it looks again at once. */
export function startWorker(deps: WorkerDeps & { readonly pollMs: number }): RunningWorker {
  const abort = new AbortController();
  const turnDeps: WorkerDeps = { ...deps, signal: abort.signal };
  let timer: NodeJS.Timeout | null = null;
  let current: Promise<void> = Promise.resolve();

  const tick = (): void => {
    timer = null;
    current = (async () => {
      let outcome: JobOutcome = 'idle';
      try {
        outcome = await processNextJob(turnDeps);
      } catch (error) {
        deps.log.warn(`worker turn failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!abort.signal.aborted) timer = setTimeout(tick, outcome === 'idle' ? deps.pollMs : 0);
    })();
  };
  tick();
  return {
    async stop() {
      abort.abort();
      if (timer) clearTimeout(timer);
      await current;
    },
  };
}
