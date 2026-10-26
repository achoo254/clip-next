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
/** Larger images are refused before decoding (a small file can declare a huge picture). */
const MAX_PIXELS = 50_000_000;
const PHOTO_TIMEOUT_MS = 30_000;

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

async function pictureSize(file: string): Promise<{ width: number; height: number }> {
  const out = await runTool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file]);
  const match = /^(\d+)x(\d+)/.exec(out.trim());
  if (!match) throw new PhotoError('photo-unreadable');
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Writes the cleaned JPEG of `bytes` to `output`. The upload goes to a temporary file in `tmpDir` (deleted
 * afterwards) because ffmpeg needs to seek in some formats.
 */
export async function cleanPhoto(bytes: Uint8Array, tmpDir: string, output: string): Promise<void> {
  if (!sniffPhotoType(bytes)) throw new PhotoError('photo-unreadable');
  await mkdir(tmpDir, { recursive: true });
  const upload = path.join(tmpDir, `upload-${randomUUID()}`);
  await writeFile(upload, bytes);
  try {
    const size = await pictureSize(upload).catch((error: unknown) => {
      throw error instanceof PhotoError ? error : new PhotoError('photo-unreadable');
    });
    if (size.width * size.height > MAX_PIXELS) throw new PhotoError('photo-too-big');
    await mkdir(path.dirname(output), { recursive: true });
    await runTool('ffmpeg', [
      '-v',
      'error',
      '-y',
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
