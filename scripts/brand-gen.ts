/**
 * `pnpm brand:gen`: everything the platforms derive from the brand, drawn from the AI-made master icon
 * (brand/app-icon-master-1024.png):
 *
 * 1. brand/icon.svg and brand/icon-maskable.svg: the master embedded as WebP (the maskable one full-bleed on the
 *    tile colour, the artwork inside the central 80% circle), the inputs the shared brand tooling draws from;
 * 2. apps/web/public/clip-mark-128.webp: the header mark, and clip-mascot-384.webp: the mascot on the welcome and
 *    sign-in pages;
 * 3. apps/web/public/og-image.png: the 1200 × 630 link preview in the app's screening-room look: the mascot, the
 *    marquee name, the welcome line and three template posters (AI art of the templates); the words are drawn here
 *    as text in the app's own fonts, never by the AI;
 * 4. brand/generated/: the web manifest, PNG icons and favicon.ico (@achoo254/brand writeBrandFiles).
 *
 * Images are encoded and drawn with the installed Google Chrome through playwright-core (no image library, no
 * browser download). Run after changing the master or brand.config.json, then commit the files.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chromiumRenderer, writeBrandFiles } from '@achoo254/brand/build';
import { primaryOrigin } from '@achoo254/brand/hosts';
import { chromium, type Page } from 'playwright-core';
import { DICTIONARIES } from '../apps/web/src/messages.js';
import { BRAND_GENERATED_DIR, BRAND_ROOT, loadClipBrand, MANIFEST_OPTIONS, OG_IMAGE } from './brand-options.js';

const MASTER = new URL('brand/app-icon-master-1024.png', BRAND_ROOT);
const MARK = new URL('apps/web/public/clip-mark-128.webp', BRAND_ROOT);
const MASCOT = new URL('apps/web/public/clip-mascot-384.webp', BRAND_ROOT);
const OG_FILE = new URL(`apps/web/public/${OG_IMAGE.path}`, BRAND_ROOT);
/** Templates whose AI backgrounds stand as posters in the link preview: left, centre, right. */
const OG_POSTERS = ['trung-thu', 'tet', 'giang-sinh'] as const;
const THEMES_DIR = new URL('packages/templates/project/themes/', BRAND_ROOT);
/** The room's colours (apps/web/src/styles/tokens.css). */
const ROOM = { bg: '#100b0c', deep: '#070506', velvet: '#5c0f1b', velvetDark: '#22050a', text: '#fbf2e4', muted: '#cdb9a4', red: '#ef3340', amber: '#ffc247' };
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

const webRequire = createRequire(new URL('apps/web/package.json', BRAND_ROOT));

/** A @fontsource weight stylesheet with its WOFF2 files inlined (WOFF fallbacks dropped), so the page renders offline. */
async function inlinedFontCss(stylesheet: string): Promise<string> {
  const file = webRequire.resolve(stylesheet);
  const css = await readFile(file, 'utf8');
  const names = [...css.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)].map((m) => m[1] ?? '');
  const inlined = new Map(await Promise.all(names.map(async (name) => [name, (await readFile(new URL(`files/${name}`, pathToFileURL(file)))).toString('base64')] as const)));
  return css.replace(/url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\)(, url\([^)]+\) format\('woff'\))?/g, (_match, name: string) => `url(data:font/woff2;base64,${inlined.get(name) ?? ''}) format('woff2')`);
}

const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (value: string): string => value.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);

interface OgText {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly host: string;
}

/** The link preview page: velvet and a bulb row above, the words on the left, three posters fanned on the right. */
async function ogHtml(mascot: string, posters: readonly string[], text: OgText): Promise<string> {
  const fonts = await Promise.all(['@fontsource/oswald/700.css', '@fontsource/be-vietnam-pro/400.css', '@fontsource/be-vietnam-pro/800.css'].map(inlinedFontCss));
  const bulbs = Array.from({ length: 30 }, (_, i) => `<i style="position:absolute;top:58px;left:${18 + i * 40}px;width:12px;height:12px;border-radius:50%;background:${ROOM.amber};box-shadow:0 0 14px 3px rgb(255 194 71 / .6)"></i>`).join('');
  const poster = (src: string, place: string): string =>
    `<img src="${src}" alt="" style="position:absolute;${place};width:230px;height:345px;object-fit:cover;border-radius:14px;border:3px solid ${ROOM.amber};box-shadow:0 26px 44px -14px rgb(0 0 0 / .9),0 0 30px rgb(255 194 71 / .25)">`;
  const [left = '', centre = '', right = ''] = posters;
  return `<!doctype html><html lang="vi"><head><style>${fonts.join('\n')}</style></head><body style="margin:0">
<div style="position:relative;width:${OG_IMAGE.width}px;height:${OG_IMAGE.height}px;overflow:hidden;color:${ROOM.text};font-family:'Be Vietnam Pro',sans-serif;background:radial-gradient(ellipse 42% 62% at 80% 62%,rgb(255 214 140 / .16),transparent 70%),radial-gradient(ellipse 50% 60% at 10% 100%,rgb(92 15 27 / .55),transparent 70%),${ROOM.bg}">
<div style="position:absolute;inset:0 0 auto 0;height:64px;background:repeating-linear-gradient(90deg,${ROOM.velvet} 0 22px,${ROOM.velvetDark} 22px 44px);box-shadow:0 8px 24px rgb(0 0 0 / .7)"></div>
${bulbs}
${poster(left, 'left:742px;top:178px;transform:rotate(-9deg)')}
${poster(right, 'left:930px;top:178px;transform:rotate(9deg)')}
${poster(centre, 'left:836px;top:150px')}
<div style="position:absolute;left:80px;top:104px;width:640px;display:flex;flex-direction:column;gap:22px">
<div style="display:flex;align-items:center;gap:26px"><img src="${mascot}" width="124" height="124" alt="" style="border-radius:28px;box-shadow:0 14px 34px -10px rgb(239 51 64 / .7)">
<div style="font-family:Oswald,sans-serif;font-weight:700;font-size:132px;line-height:1;letter-spacing:.04em;text-transform:uppercase;color:${ROOM.text};text-shadow:0 0 6px ${ROOM.red},0 0 22px ${ROOM.red},0 0 48px rgb(239 51 64 / .6)">${esc(text.name)}</div></div>
<div style="font-weight:800;font-size:50px;line-height:1.15">${esc(text.title)}</div>
<div style="font-size:27px;line-height:1.4;color:${ROOM.muted}">${esc(text.description)}</div>
<div style="font-family:Oswald,sans-serif;font-weight:700;font-size:28px;letter-spacing:.06em;color:${ROOM.amber}">${esc(text.host)}</div>
</div></div></body></html>`;
}

/** The link preview as PNG bytes. */
async function ogImage(page: Page, master: Buffer): Promise<Buffer> {
  const brand = loadClipBrand();
  const mascot = `data:image/webp;base64,${(await webp(page, master, 248, 0.92)).toString('base64')}`;
  const posters = await Promise.all(OG_POSTERS.map(async (id) => `data:image/webp;base64,${(await readFile(new URL(`${id}/bg.webp`, THEMES_DIR))).toString('base64')}`));
  const text = { name: brand.appName, title: DICTIONARIES.vi['intro.title'], description: brand.description, host: new URL(primaryOrigin(brand)).host };
  await page.setViewportSize({ width: OG_IMAGE.width, height: OG_IMAGE.height });
  await page.setContent(await ogHtml(mascot, posters, text));
  await page.locator('img').evaluateAll((images: HTMLImageElement[]) => Promise.all(images.map((img) => img.decode())));
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ clip: { x: 0, y: 0, width: OG_IMAGE.width, height: OG_IMAGE.height } });
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
    await writeFile(OG_FILE, await ogImage(page, master));
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
  console.log(`Wrote brand/icon.svg, brand/icon-maskable.svg, apps/web/public/clip-{mark-128,mascot-384}.webp, og-image.png and ${written.length} files to brand/generated/`);
}

main().catch((error: unknown) => {
  console.error('brand:gen failed:', error);
  process.exitCode = 1;
});
