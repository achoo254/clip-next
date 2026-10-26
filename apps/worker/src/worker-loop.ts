import { rm } from 'node:fs/promises';
import path from 'node:path';
import { claimNextJob, failStuckJobs, markJobDone, markJobFailed, type Db, type MediaLayout, type RenderJob } from '@clip/db';
import { compositionVariables, isTemplateId, templateById } from '@clip/templates';
import { RenderError, type RenderInput, type RenderResult } from './render';

/** Renders one job's video; `renderVideo` in production, injectable for tests of the queue. */
export type Renderer = (input: RenderInput) => Promise<RenderResult>;

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
}

export type JobOutcome = 'idle' | 'done' | 'failed';

/** The render input of a job: its fields and photos as composition variables, photos copied as `photos/…`. */
export function renderInputFor(job: RenderJob, media: MediaLayout): RenderInput {
  if (!isTemplateId(job.templateId)) throw new RenderError('render-failed', `unknown template ${job.templateId}`);
  const photos = Array.from({ length: job.photoCount }, (_, index) => media.photo(job.id, index));
  const variables = compositionVariables(
    templateById(job.templateId),
    job.fields,
    photos.map((file) => `photos/${path.basename(file)}`),
  );
  return { templateId: job.templateId, variables, photos, workDir: path.join(media.tmp, `render-${job.id}`), output: media.video(job.id) };
}

/**
 * One turn of the worker: fails jobs stuck in `rendering`, then claims the oldest queued job and renders it. The
 * job's photos are deleted afterwards either way; only the video is kept.
 */
export async function processNextJob(deps: WorkerDeps): Promise<JobOutcome> {
  const now = deps.now ?? (() => new Date());
  const stuck = await failStuckJobs(deps.db, now());
  for (const id of stuck) deps.log.warn(`job ${id} was rendering too long: marked failed`);
  const job = await claimNextJob(deps.db, now());
  if (!job) return 'idle';
  deps.log.info(`job ${job.id} rendering (${job.templateId}, ${job.photoCount} photo(s))`);
  try {
    const result = await deps.render(renderInputFor(job, deps.media));
    const kept = await markJobDone(deps.db, job.id, { outputBytes: result.bytes, durationSeconds: result.durationSeconds, renderMs: result.renderMs }, now());
    if (!kept) {
      // Marked stuck while this render ran long: the job is failed for the user, so its file must not linger.
      await rm(deps.media.video(job.id), { force: true });
      deps.log.warn(`job ${job.id} finished after it was marked failed: video removed`);
      return 'failed';
    }
    deps.log.info(`job ${job.id} done in ${result.renderMs} ms (${result.durationSeconds} s video, ${result.bytes} bytes)`);
    return 'done';
  } catch (error) {
    const code = error instanceof RenderError ? error.code : 'render-failed';
    const detail = error instanceof RenderError ? error.detail : error instanceof Error ? error.message : String(error);
    deps.log.warn(`job ${job.id} failed: ${code}: ${detail}`);
    await markJobFailed(deps.db, job.id, code, now());
    return 'failed';
  } finally {
    await rm(deps.media.inputDir(job.id), { recursive: true, force: true });
  }
}

export interface RunningWorker {
  /** Stops polling and waits for the job in hand (if any) to finish. */
  stop(): Promise<void>;
}

/** Polls the queue every `pollMs`, one job at a time; right after a job it looks again at once. */
export function startWorker(deps: WorkerDeps & { readonly pollMs: number }): RunningWorker {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let current: Promise<void> = Promise.resolve();

  const tick = (): void => {
    timer = null;
    current = (async () => {
      let outcome: JobOutcome = 'idle';
      try {
        outcome = await processNextJob(deps);
      } catch (error) {
        deps.log.warn(`worker turn failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (!stopped) timer = setTimeout(tick, outcome === 'idle' ? deps.pollMs : 0);
    })();
  };
  tick();
  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await current;
    },
  };
}
