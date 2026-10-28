import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { THEME_BOOTSTRAP_MARKER, THEME_BOOTSTRAP_SCRIPT, themeBootstrap } from './vite-theme-bootstrap.ts';

/*
 * The inline theme script (vite-theme-bootstrap.ts puts the shared script of @achoo254/app-shell in index.html)
 * runs only if the CSP names its hash. A new package version or option changes the text, so this fails first and
 * prints the hash to put in `$clip_csp` of the nginx site.
 */
const file = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));
const NGINX_CONF = file('../../infra/nginx/clip.hoandat.com.conf');

describe('theme bootstrap script', () => {
  it('is allowed by every script-src of the CSP, next to Cloudflare Web Analytics', () => {
    const hash = `'sha256-${createHash('sha256').update(THEME_BOOTSTRAP_SCRIPT).digest('base64')}'`;
    const scriptSrcs = readFileSync(NGINX_CONF, 'utf8').match(/script-src [^;"]*/g) ?? [];
    expect(scriptSrcs.length).toBeGreaterThan(0);
    for (const scriptSrc of scriptSrcs) {
      expect(scriptSrc, `script-src needs ${hash}`).toContain(hash);
      expect(scriptSrc).toContain('https://static.cloudflareinsights.com');
    }
  });

  it('reads the shared theme cookie', () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('hd_theme');
  });

  it('has one place in index.html, no other inline script, and fills it in', () => {
    const html = readFileSync(file('./index.html'), 'utf8');
    expect(html.split(THEME_BOOTSTRAP_MARKER)).toHaveLength(2);
    expect(html).not.toMatch(/<script>(?!\s*<\/script>)/);
    const transform = themeBootstrap().transformIndexHtml;
    if (typeof transform !== 'function') throw new Error('transformIndexHtml is not a plain function');
    const out = transform.call(undefined as never, html, undefined as never);
    expect(out).toContain(`<script>${THEME_BOOTSTRAP_SCRIPT}</script>`);
    expect(out).not.toContain(THEME_BOOTSTRAP_MARKER);
  });
});
