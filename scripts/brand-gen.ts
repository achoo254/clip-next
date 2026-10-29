/**
 * `pnpm brand:gen`: everything the platforms derive from the brand, drawn from the AI-made master icon
 * (brand/app-icon-master-1024.png):
 *
 * 1. brand/icon.svg and brand/icon-maskable.svg: the master embedded as WebP (the maskable one full-bleed on the
 *    tile colour, the artwork inside the central 80% circle), the inputs the shared brand tooling draws from;
 * 2. apps/web/public/clip-mark-128.webp: the header mark, and clip-mascot-384.webp: the mascot on the welcome and
 *    sign-in pages;
 * 3. brand/generated/: the web manifest, PNG icons and favicon.ico (@achoo254/brand writeBrandFiles).
 *
 * Images are encoded and drawn with the installed Google Chrome through playwright-core (no image library, no
 * browser download). Run after changing the master or brand.config.json, then commit the files.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { chromiumRenderer, writeBrandFiles } from '@achoo254/brand/build';
import { chromium, type Page } from 'playwright-core';
import { BRAND_GENERATED_DIR, BRAND_ROOT, loadClipBrand, MANIFEST_OPTIONS } from './brand-options.js';

const MASTER = new URL('brand/app-icon-master-1024.png', BRAND_ROOT);
const MARK = new URL('apps/web/public/clip-mark-128.webp', BRAND_ROOT);
const MASCOT = new URL('apps/web/public/clip-mascot-384.webp', BRAND_ROOT);
/** The icon tile's coral pink, behind the maskable icon so the artwork can sit inside the safe zone. */
const TILE = '#f7537a';

/** The master scaled to `size` as WebP bytes, encoded by Chrome's canvas. */
async function webp(page: Page, png: Buffer, size: number, quality: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    async ({ src, size, quality }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/webp', quality);
    },
    { src: `data:image/png;base64,${png.toString('base64')}`, size, quality },
  );
  const prefix = 'data:image/webp;base64,';
  if (!dataUrl.startsWith(prefix)) throw new Error('Chrome did not encode WebP');
  return Buffer.from(dataUrl.slice(prefix.length), 'base64');
}

/** The system Google Chrome, in the shape the brand tooling's renderer expects. */
const launcher = { launch: () => chromium.launch({ channel: 'chrome' }) };

async function main(): Promise<void> {
  const master = await readFile(MASTER);
  const browser = await launcher.launch();
  try {
    const page = await browser.newPage();
    const icon = (await webp(page, master, 512, 0.9)).toString('base64');
    const note =
      '<!-- Clip app icon: AI-generated with open models (FLUX.2 klein 4B; Apache-2.0) for the hoandat ecosystem (brand/app-icon-master-1024.png), embedded as WebP by pnpm brand:gen. -->';
    await writeFile(
      new URL('brand/icon.svg', BRAND_ROOT),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${note}<image width="512" height="512" href="data:image/webp;base64,${icon}"/></svg>\n`,
    );
    await writeFile(
      new URL('brand/icon-maskable.svg', BRAND_ROOT),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${note}<rect width="512" height="512" fill="${TILE}"/><image x="61" y="61" width="390" height="390" href="data:image/webp;base64,${icon}"/></svg>\n`,
    );
    await writeFile(MARK, await webp(page, master, 128, 0.92));
    await writeFile(MASCOT, await webp(page, master, 384, 0.82));
  } finally {
    await browser.close();
  }
  const written = await writeBrandFiles({
    brand: loadClipBrand(),
    root: BRAND_ROOT,
    generatedDir: BRAND_GENERATED_DIR,
    manifests: MANIFEST_OPTIONS,
    indent: 2,
    renderer: chromiumRenderer(launcher),
  });
  console.log(`Wrote brand/icon.svg, brand/icon-maskable.svg, apps/web/public/clip-{mark-128,mascot-384}.webp and ${written.length} files to brand/generated/`);
}

main().catch((error: unknown) => {
  console.error('brand:gen failed:', error);
  process.exitCode = 1;
});
