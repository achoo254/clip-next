import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanPhoto, lumaRange, MIN_LUMA_RANGE, PhotoError } from './photo-cleaning';

const FIXTURES = path.join(path.dirname(new URL(import.meta.url).pathname), 'photo-fixtures');
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'clip-photos-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function size(file: string): string {
  return spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim();
}

/** Photos as phones and editors save them: each must come out a visible, metadata-free JPEG. */
const PHOTOS: readonly [string, string][] = [
  ['orient6.jpg', '480,640'],
  ['orient8.jpg', '480,640'],
  ['progressive.jpg', '640,480'],
  ['cmyk.jpg', '640,480'],
  ['gray.jpg', '640,480'],
  ['subsampling-444.jpg', '640,480'],
  ['portrait.jpg', '480,640'],
  ['icc.png', '640,480'],
  ['png16.png', '640,480'],
  ['alpha.png', '640,480'],
  ['photo.webp', '640,480'],
];

describe('cleanPhoto', () => {
  for (const [name, expected] of PHOTOS) {
    it(`${name}: a visible JPEG, upright, no EXIF`, async () => {
      const output = path.join(dir, `${name}.jpg`);
      await cleanPhoto(await readFile(path.join(FIXTURES, name)), dir, output);
      expect(size(output)).toBe(expected);
      const luma = await lumaRange(output);
      expect(luma.max - luma.min).toBeGreaterThanOrEqual(MIN_LUMA_RANGE);
      const bytes = await readFile(output);
      // No EXIF (GPS, camera); a colour profile, when the source has one, is kept so the colours stay right.
      expect(bytes.includes(Buffer.from('Exif'))).toBe(false);
    });
  }

  for (const name of ['all-white.png', 'transparent.png']) {
    it(`${name}: refused as blank, nothing stored`, async () => {
      const output = path.join(dir, `${name}.jpg`);
      const error = await cleanPhoto(await readFile(path.join(FIXTURES, name)), dir, output).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PhotoError);
      expect((error as PhotoError).code).toBe('photo-blank');
      expect(existsSync(output)).toBe(false);
    });
  }

  it('lays half-transparent pixels on white, not black', async () => {
    const output = path.join(dir, 'alpha-check.jpg');
    await cleanPhoto(await readFile(path.join(FIXTURES, 'alpha.png')), dir, output);
    // The fixture is 50% alpha over a mid-tone picture: on white its darkest luma stays well above black.
    expect((await lumaRange(output)).min).toBeGreaterThan(90);
  });
});
