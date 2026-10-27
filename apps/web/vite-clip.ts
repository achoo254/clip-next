/*
 * Vite plugins of the web app.
 *
 * clipBrand: brand assets derived from brand.config.json through @achoo254/brand (manifest, favicon, PNG icons
 * made by `pnpm brand:gen`), served in dev and emitted in builds, plus the head tags in index.html. A rebrand is
 * "edit the brand files, pnpm brand:gen, rebuild".
 *
 * clipTemplates: what the in-browser preview and the template picker load besides the layout HTML (which the app
 * imports as text): the layouts' scripts, the themes (AI art, colours, thumbnails) and the fonts and music under /tpl/, and the hyperframes runtime (@hyperframes/core, same pinned
 * version as the worker's renderer) as /tpl/hyperframe.runtime.js. Served from the same origin so the strict CSP
 * (no inline script, no CDN) holds inside the preview frame too.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAVICON_ICO, generateManifests, loadBrandConfig, RASTER_ICONS, webIconFiles } from '@achoo254/brand/build';
import { primaryOrigin } from '@achoo254/brand/hosts';
import type { Plugin } from 'vite';
import { MANIFEST_OPTIONS } from '../../scripts/brand-options.ts';

const require = createRequire(import.meta.url);
const REPO_ROOT = new URL('../../', import.meta.url);
const BRAND_GENERATED_DIR = new URL('brand/generated/', REPO_ROOT);
const PROJECT_DIR = path.join(path.dirname(require.resolve('@clip/templates/package.json')), 'project');
const RUNTIME_FILE = path.join(path.dirname(require.resolve('@hyperframes/core/package.json')), 'dist', 'hyperframe.runtime.iife.js');

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.js': 'text/javascript',
  '.ttf': 'font/ttf',
  '.m4a': 'audio/mp4',
  '.webp': 'image/webp',
  '.css': 'text/css',
  '.txt': 'text/plain; charset=utf-8',
};

function contentType(file: string): string {
  return CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream';
}

/** Serves `files` (URL path without the leading slash → reader) in dev and emits them in builds. */
function servedFiles(name: string, files: () => ReadonlyMap<string, () => Buffer | string>): Plugin {
  return {
    name,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]?.slice(1) ?? '';
        const read = files().get(decodeURIComponent(url));
        if (read === undefined) return next();
        try {
          res.setHeader('Content-Type', contentType(url));
          res.end(read());
        } catch (error) {
          next(error);
        }
      });
    },
    generateBundle() {
      for (const [fileName, read] of files()) this.emitFile({ type: 'asset', fileName, source: read() });
    },
  };
}

const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value: string): string => value.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);

/** Placeholder in index.html the brand tags replace. */
const BRAND_TAGS = '<!-- brand-tags -->';

export function clipBrand(): Plugin[] {
  const brand = loadBrandConfig(REPO_ROOT, { require: ['webInstall', 'colors.primary', 'colors.backgroundDark'] });
  const manifest = `${JSON.stringify(generateManifests(brand, MANIFEST_OPTIONS)['web.webmanifest.json'])}\n`;
  const icons = webIconFiles(brand, { root: REPO_ROOT, generatedDir: BRAND_GENERATED_DIR });
  const files = new Map<string, () => Buffer | string>([...icons.map((icon) => [icon.path, () => readFileSync(icon.file)] as const), ['manifest.webmanifest', () => manifest]]);
  const appleTouch = RASTER_ICONS.find((icon) => icon.file.startsWith('apple-touch-icon'));
  const favicon = icons.find((icon) => icon.path.endsWith('.svg'));
  const origin = primaryOrigin(brand);
  const tags = [
    `<title>${escapeHtml(brand.appName)}</title>`,
    `<meta name="description" content="${escapeHtml(brand.description)}" />`,
    `<meta name="theme-color" content="${brand.colors.background}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(brand.appName)}" />`,
    `<meta property="og:title" content="${escapeHtml(brand.appName)}" />`,
    `<meta property="og:description" content="${escapeHtml(brand.description)}" />`,
    `<meta property="og:url" content="${origin}/" />`,
    `<link rel="manifest" href="/manifest.webmanifest" />`,
    `<link rel="icon" href="/${FAVICON_ICO}" sizes="16x16 32x32 48x48" />`,
    ...(favicon ? [`<link rel="icon" type="image/svg+xml" href="/${favicon.path}" />`] : []),
    ...(appleTouch ? [`<link rel="apple-touch-icon" href="/${appleTouch.file}" sizes="${appleTouch.size}x${appleTouch.size}" />`] : []),
    `<meta name="apple-mobile-web-app-title" content="${escapeHtml(brand.shortName)}" />`,
  ].join('\n    ');
  return [
    servedFiles('clip-brand-files', () => files),
    {
      name: 'clip-brand-html',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          if (!html.includes(BRAND_TAGS)) throw new Error(`index.html must contain ${BRAND_TAGS}`);
          return html.replace(BRAND_TAGS, tags);
        },
      },
    },
  ];
}

/** Every file under `dir`, as paths relative to it (forward slashes). */
function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    return statSync(full).isDirectory() ? walk(full, rel) : [rel];
  });
}

export function clipTemplates(): Plugin {
  return servedFiles('clip-template-files', () => {
    const files = new Map<string, () => Buffer>();
    for (const sub of ['scripts', 'assets', 'themes']) {
      for (const rel of walk(path.join(PROJECT_DIR, sub))) files.set(`tpl/${sub}/${rel}`, () => readFileSync(path.join(PROJECT_DIR, sub, rel)));
    }
    files.set('tpl/hyperframe.runtime.js', () => readFileSync(RUNTIME_FILE));
    return files;
  });
}

/** The app's public origin (https://clip.<domain>), from the brand. */
export function clipOrigin(): string {
  return primaryOrigin(loadBrandConfig(REPO_ROOT));
}

/** Repo root as a file path (for fs.allow). */
export const REPO_ROOT_PATH = fileURLToPath(REPO_ROOT);
