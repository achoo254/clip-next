/**
 * Uploaded photos are never stored as sent: the type is checked by its first bytes (JPEG, PNG or WebP only), then
 * ffmpeg (already on the server for the renders; no native image module) decodes it, scales it to at most 1080 px
 * on its longer side and writes a fresh JPEG without any metadata — EXIF, GPS position and camera details are gone.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type PhotoType = 'jpeg' | 'png' | 'webp';

/** The image type from its magic bytes, or null when it is none of the accepted ones. */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  const starts = (sig: readonly number[], offset = 0): boolean => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return 'jpeg';
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  // RIFF....WEBP
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  return null;
}

/** Longest side of a stored photo, in pixels. */
export const MAX_PHOTO_SIDE = 1080;
/**
 * Larger pictures are refused before decoding: a small file can declare a huge picture, and ffmpeg decodes it whole
 * (24 MP is about 100 MB of RGBA) inside the server's memory limit. Phone photos (6000×4000) fit.
 */
export const MAX_PIXELS = 24_000_000;
const PHOTO_TIMEOUT_MS = 30_000;
/** Photos decoded at once in the whole server: each decode can take a few hundred MB. */
const MAX_CONCURRENT_PHOTOS = 2;

/** ffmpeg's demuxer for each accepted type: the input is never probed as anything else. */
const DEMUXER: Readonly<Record<PhotoType, string>> = { jpeg: 'jpeg_pipe', png: 'png_pipe', webp: 'webp_pipe' };

/** A counting semaphore: at most `limit` holders, the rest wait in order. */
export class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

const photoSlots = new Semaphore(MAX_CONCURRENT_PHOTOS);

export class PhotoError extends Error {
  constructor(readonly code: 'photo-unreadable' | 'photo-too-big') {
    super(code);
    this.name = 'PhotoError';
  }
}

function runTool(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      err = (err + chunk.toString()).slice(-1_000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), PHOTO_TIMEOUT_MS);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${command} exit ${String(code)}: ${err.slice(-300)}`));
    });
  });
}

async function pictureSize(file: string, type: PhotoType): Promise<{ width: number; height: number }> {
  const out = await runTool('ffprobe', [
    '-v',
    'error',
    '-protocol_whitelist',
    'file',
    '-f',
    DEMUXER[type],
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0:s=x',
    file,
  ]);
  const match = /^(\d+)x(\d+)/.exec(out.trim());
  if (!match) throw new PhotoError('photo-unreadable');
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Writes the cleaned JPEG of `bytes` to `output`. The upload goes to a temporary file in `tmpDir` (deleted
 * afterwards) because ffmpeg needs to seek in some formats. At most MAX_CONCURRENT_PHOTOS run at once in the
 * process, each ffmpeg on one thread.
 */
export function cleanPhoto(bytes: Uint8Array, tmpDir: string, output: string): Promise<void> {
  const type = sniffPhotoType(bytes);
  if (!type) return Promise.reject(new PhotoError('photo-unreadable'));
  return photoSlots.run(() => cleanTyped(bytes, type, tmpDir, output));
}

async function cleanTyped(bytes: Uint8Array, type: PhotoType, tmpDir: string, output: string): Promise<void> {
  await mkdir(tmpDir, { recursive: true });
  const upload = path.join(tmpDir, `upload-${randomUUID()}`);
  await writeFile(upload, bytes);
  try {
    const size = await pictureSize(upload, type).catch((error: unknown) => {
      throw error instanceof PhotoError ? error : new PhotoError('photo-unreadable');
    });
    if (size.width * size.height > MAX_PIXELS) throw new PhotoError('photo-too-big');
    await mkdir(path.dirname(output), { recursive: true });
    await runTool('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-filter_threads',
      '1',
      '-threads',
      '1',
      '-protocol_whitelist',
      'file',
      '-f',
      DEMUXER[type],
      '-i',
      upload,
      '-frames:v',
      '1',
      '-vf',
      `scale=w='min(${MAX_PHOTO_SIDE},iw)':h='min(${MAX_PHOTO_SIDE},ih)':force_original_aspect_ratio=decrease,format=yuvj420p`,
      '-map_metadata',
      '-1',
      '-q:v',
      '3',
      '-f',
      'image2',
      output,
    ]).catch(() => {
      throw new PhotoError('photo-unreadable');
    });
  } finally {
    await rm(upload, { force: true });
  }
}
