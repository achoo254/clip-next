/**
 * The one module that runs hyperframes (pinned in package.json; the server measurement was made with 0.8.201).
 *
 * Two paths, by what the ffmpeg in use can encode (FFMPEG_PATH, else the one on PATH):
 * - with libx264, hyperframes writes H.264 MP4 itself (JPEG frame capture), then ffmpeg only moves the index to the
 *   front (`+faststart`, no re-encode);
 * - without it (the server's distribution ffmpeg), hyperframes can only write WebM, which it captures as PNG with
 *   alpha — about five times slower for the AI-drawn backgrounds (Mac: 110 s against 20 s for a 10 s video) — and
 *   ffmpeg re-encodes that to H.264 with libopenh264 (same choice as tieu-de-next's Shorts).
 * Both use hyperframes' low-memory profile and one Chrome worker; on Linux the tools run under `nice` so the shared
 * server's other apps keep their CPU.
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
  /** ffmpeg and ffprobe to use (for hyperframes too); unset: the ones on PATH. */
  readonly ffmpegPath?: string;
  readonly ffprobePath?: string;
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
export function hyperframesEnv(chromePath: string | undefined, tools: { ffmpegPath?: string; ffprobePath?: string } = {}): NodeJS.ProcessEnv {
  const passed = Object.fromEntries(PASSED_ENV.flatMap((key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]])));
  return {
    ...passed,
    HYPERFRAMES_NO_TELEMETRY: '1',
    DO_NOT_TRACK: '1',
    HYPERFRAMES_NO_UPDATE_CHECK: '1',
    HYPERFRAMES_SKIP_SKILLS: '1',
    HYPERFRAMES_NO_AUTO_INSTALL: '1',
    ...(chromePath ? { HYPERFRAMES_BROWSER_PATH: chromePath } : {}),
    ...(tools.ffmpegPath ? { HYPERFRAMES_FFMPEG_PATH: tools.ffmpegPath } : {}),
    ...(tools.ffprobePath ? { HYPERFRAMES_FFPROBE_PATH: tools.ffprobePath } : {}),
  };
}

const x264Support = new Map<string, boolean>();

/** Whether this ffmpeg can encode H.264 with libx264 (asked once per binary). */
export function hasLibx264(ffmpeg: string): boolean {
  const known = x264Support.get(ffmpeg);
  if (known !== undefined) return known;
  const encoders = spawnSync(ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout ?? '';
  const supported = /\blibx264\b/.test(encoders);
  x264Support.set(ffmpeg, supported);
  return supported;
}

/** The quality of the MP4 hyperframes writes itself (its default CRF 16 doubles the file for no visible gain). */
const MP4_CRF = '23';

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
export function probeVideo(file: string, ffprobe = 'ffprobe'): ProbedVideo | null {
  const out = spawnSync(
    ffprobe,
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
 * renders with hyperframes (MP4 directly, or WebM then H.264; see the top of this file), checks the result with
 * ffprobe and moves it into place.
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

    const ffmpeg = options.ffmpegPath ?? 'ffmpeg';
    const env = hyperframesEnv(options.chromePath, options);
    const direct = hasLibx264(ffmpeg);
    const rendered = path.join(workDir, direct ? 'render.mp4' : 'render.webm');
    const format = direct ? ['--format', 'mp4', '--crf', MP4_CRF] : ['--format', 'webm', '--vp9-cpu-used', '8'];
    await runTool(
      process.execPath,
      [
        hyperframesBin(),
        'render',
        workDir,
        ...format,
        '--low-memory-mode',
        '--workers',
        '1',
        '--quiet',
        '--strict-variables',
        '--variables-file',
        variablesFile,
        '--output',
        rendered,
      ],
      { env, deadline, code: 'render-failed', signal: options.signal },
    );

    const mp4 = path.join(workDir, 'video.mp4');
    const encode = direct
      ? ['-c', 'copy']
      : ['-c:v', 'libopenh264', '-b:v', '3500k', '-maxrate', '4500k', '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'aac', '-b:a', '128k'];
    await runTool(ffmpeg, ['-v', 'error', '-y', '-i', rendered, ...encode, '-movflags', '+faststart', mp4], {
      env,
      deadline,
      code: 'encode-failed',
      signal: options.signal,
    });

    const probed = probeVideo(mp4, options.ffprobePath);
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
