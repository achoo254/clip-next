/**
 * The one module that runs hyperframes (pinned in package.json; the server measurement was made with 0.8.201).
 *
 * The server's ffmpeg has no libx264, so hyperframes cannot write MP4 there: it renders WebM (VP9) with the
 * low-memory profile and one Chrome worker, then ffmpeg turns that into H.264 MP4 — libx264 when the local ffmpeg
 * has it, else libopenh264 (same choice as tieu-de-next's Shorts). On Linux both run under `nice` so the shared
 * server's other apps keep their CPU. Measured on the server: about 5.8 s of render per second of video, at least
 * 2.4 GB memory left while rendering.
 */
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { MAX_DURATION_SECONDS, type TemplateId } from '@clip/templates';
import { prepareProject } from '@clip/templates/project';

export interface RenderInput {
  readonly templateId: TemplateId;
  /** Composition variables; photo variables hold paths relative to the project (`photos/photo-1.jpg`). */
  readonly variables: Readonly<Record<string, string>>;
  /** Absolute paths of the photos, copied into the project as `photos/<file name>`. */
  readonly photos: readonly string[];
  /** Empty scratch directory for this render (removed afterwards). */
  readonly workDir: string;
  /** Final MP4 path; written by rename once the video is checked. */
  readonly output: string;
}

export interface RenderOptions {
  /** Chrome for hyperframes (HYPERFRAMES_BROWSER_PATH); unset: hyperframes finds or downloads its own. */
  readonly chromePath?: string;
  /** Hard stop for the whole render; the job is failed when it is reached. */
  readonly timeoutMs: number;
  /** Aborts the render (the worker is stopping): the tools are killed and the render rejects with `aborted`. */
  readonly signal?: AbortSignal;
}

export interface RenderResult {
  readonly bytes: number;
  readonly durationSeconds: number;
  readonly renderMs: number;
}

/** A render failure with a stable code (stored on the job) and the tail of the tool's output (logged only). */
export class RenderError extends Error {
  constructor(
    readonly code: 'render-failed' | 'encode-failed' | 'timeout' | 'aborted' | 'bad-output',
    readonly detail: string,
  ) {
    super(code);
    this.name = 'RenderError';
  }
}

const WIDTH = 1080;
const HEIGHT = 1920;

/** The hyperframes CLI of this package's pinned dependency. */
export function hyperframesBin(): string {
  const pkg = createRequire(import.meta.url).resolve('hyperframes/package.json');
  return path.join(path.dirname(pkg), 'bin', 'hyperframes.mjs');
}

/** What of the worker's own environment the tools may see: nothing secret (no DATABASE_URL, no client secret). */
const PASSED_ENV = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ'] as const;

/**
 * Environment for hyperframes, Chrome and ffmpeg: a minimal one (the worker's env holds the database password and
 * the sign-in secret, which a compromised renderer must not read); no telemetry, update checks, skill downloads or
 * automatic installs; our Chrome.
 */
export function hyperframesEnv(chromePath: string | undefined): NodeJS.ProcessEnv {
  const passed = Object.fromEntries(PASSED_ENV.flatMap((key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]])));
  return {
    ...passed,
    HYPERFRAMES_NO_TELEMETRY: '1',
    DO_NOT_TRACK: '1',
    HYPERFRAMES_NO_UPDATE_CHECK: '1',
    HYPERFRAMES_SKIP_SKILLS: '1',
    HYPERFRAMES_NO_AUTO_INSTALL: '1',
    ...(chromePath ? { HYPERFRAMES_BROWSER_PATH: chromePath } : {}),
  };
}

let codecArgs: readonly string[] | null = null;

/** H.264 settings for the ffmpeg at hand: libx264 when it has it, else libopenh264. */
export function videoCodecArgs(): readonly string[] {
  if (codecArgs) return codecArgs;
  const encoders = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout ?? '';
  codecArgs = /\blibx264\b/.test(encoders)
    ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-maxrate', '4500k', '-bufsize', '9000k']
    : ['-c:v', 'libopenh264', '-b:v', '3500k', '-maxrate', '4500k'];
  return codecArgs;
}

/** `command args`, under `nice -n 15` on Linux (the production server). */
function niced(command: string, args: readonly string[]): [string, string[]] {
  return process.platform === 'linux' ? ['nice', ['-n', '15', command, ...args]] : [command, [...args]];
}

/** Time a killed tool gets to clean up (puppeteer closes Chrome on SIGTERM) before the group gets SIGKILL. */
export const KILL_GRACE_MS = 10_000;

/** Signals the tool's whole process group (it leads one: spawned detached); a group already gone is fine. */
function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch {
    // Already exited.
  }
}

export interface RunOptions {
  readonly env: NodeJS.ProcessEnv;
  /** Epoch ms at which the tool is killed and the run rejects with `timeout`. */
  readonly deadline: number;
  /** Error code when the tool exits non-zero. */
  readonly code: RenderError['code'];
  readonly signal?: AbortSignal;
  readonly graceMs?: number;
}

/**
 * Runs a tool to completion; rejects with the last lines of its output. The tool leads its own process group, so a
 * timeout or an abort reaches everything it started that stayed in the group (ffmpeg, helpers): SIGTERM first, so
 * hyperframes can close the Chrome it launched (Chrome has a group of its own), then SIGKILL after the grace period.
 */
export function runTool(command: string, args: readonly string[], options: RunOptions): Promise<void> {
  const [bin, binArgs] = niced(command, args);
  const grace = options.graceMs ?? KILL_GRACE_MS;
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new RenderError('aborted', 'aborted before start'));
    const child = spawn(bin, binArgs, { env: options.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let output = '';
    const keep = (chunk: Buffer): void => {
      output = (output + chunk.toString()).slice(-4_000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    let stopped: 'timeout' | 'aborted' | null = null;
    let killTimer: NodeJS.Timeout | null = null;
    const stop = (why: 'timeout' | 'aborted'): void => {
      if (stopped) return;
      stopped = why;
      signalGroup(child.pid, 'SIGTERM');
      killTimer = setTimeout(() => signalGroup(child.pid, 'SIGKILL'), grace);
    };
    const timer = setTimeout(() => stop('timeout'), Math.max(0, options.deadline - Date.now()));
    const onAbort = (): void => stop('aborted');
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const done = (): void => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    };
    child.on('error', (error) => {
      done();
      reject(new RenderError(options.code, error.message));
    });
    child.on('close', (exit) => {
      done();
      // Whatever the tool left in its group goes too.
      if (stopped) {
        signalGroup(child.pid, 'SIGKILL');
        if (killTimer) clearTimeout(killTimer);
        reject(new RenderError(stopped, output.slice(-800)));
      } else if (exit === 0) resolve();
      else reject(new RenderError(options.code, `exit ${String(exit)}: ${output.slice(-800)}`));
    });
  });
}

interface ProbedVideo {
  readonly codec: string;
  readonly width: number;
  readonly height: number;
  readonly duration: number;
}

/** Codec, size and length of a video file, from ffprobe. */
export function probeVideo(file: string): ProbedVideo | null {
  const out = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height:format=duration', '-of', 'json', file],
    { encoding: 'utf8' },
  ).stdout;
  try {
    const parsed: unknown = JSON.parse(out ?? '');
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { streams, format } = parsed as { streams?: unknown; format?: { duration?: unknown } };
    const stream: unknown = Array.isArray(streams) ? streams[0] : undefined;
    if (typeof stream !== 'object' || stream === null) return null;
    const { codec_name: codec, width, height } = stream as { codec_name?: unknown; width?: unknown; height?: unknown };
    const duration = Number(format?.duration);
    if (typeof codec !== 'string' || typeof width !== 'number' || typeof height !== 'number' || !Number.isFinite(duration)) return null;
    return { codec, width, height, duration };
  } catch {
    return null;
  }
}

/**
 * Renders one template into an MP4 at `input.output`: lays out the project and photos in the work directory,
 * renders WebM with hyperframes, encodes H.264, checks the result with ffprobe and moves it into place.
 */
export async function renderVideo(input: RenderInput, options: RenderOptions): Promise<RenderResult> {
  const started = Date.now();
  const deadline = started + options.timeoutMs;
  const { workDir } = input;
  await mkdir(workDir, { recursive: true });
  try {
    await prepareProject(input.templateId, workDir);
    await mkdir(path.join(workDir, 'photos'), { recursive: true });
    for (const photo of input.photos) await cp(photo, path.join(workDir, 'photos', path.basename(photo)));
    const variablesFile = path.join(workDir, 'variables.json');
    await writeFile(variablesFile, JSON.stringify(input.variables));

    const env = hyperframesEnv(options.chromePath);
    const webm = path.join(workDir, 'render.webm');
    await runTool(
      process.execPath,
      [
        hyperframesBin(),
        'render',
        workDir,
        '--format',
        'webm',
        '--vp9-cpu-used',
        '8',
        '--low-memory-mode',
        '--workers',
        '1',
        '--quiet',
        '--strict-variables',
        '--variables-file',
        variablesFile,
        '--output',
        webm,
      ],
      { env, deadline, code: 'render-failed', signal: options.signal },
    );

    const mp4 = path.join(workDir, 'video.mp4');
    await runTool(
      'ffmpeg',
      [
        '-v',
        'error',
        '-y',
        '-i',
        webm,
        ...videoCodecArgs(),
        '-pix_fmt',
        'yuv420p',
        '-threads',
        '2',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        mp4,
      ],
      { env, deadline, code: 'encode-failed', signal: options.signal },
    );

    const probed = probeVideo(mp4);
    if (!probed || probed.codec !== 'h264' || probed.width !== WIDTH || probed.height !== HEIGHT || probed.duration > MAX_DURATION_SECONDS + 0.5) {
      throw new RenderError('bad-output', JSON.stringify(probed));
    }
    const { size } = await stat(mp4);
    await mkdir(path.dirname(input.output), { recursive: true });
    await rename(mp4, input.output);
    return { bytes: size, durationSeconds: Math.round(probed.duration * 100) / 100, renderMs: Date.now() - started };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
