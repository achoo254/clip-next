import { describe, expect, it } from 'vitest';
import { TEMPLATES, templateById } from '@clip/templates';
import indexHtml from '../../index.html?raw';
import { pageHtml, robotsTxt, seoPages, sitemapXml } from '../../vite-seo';
import { relatedTemplates, templatePagePath, templatesByOccasion } from './template-pages';

const ORIGIN = 'https://clip.example.com';
const INDEX = indexHtml.replace(
  '<!-- brand-tags -->',
  [
    '<title>Clip</title>',
    '<meta name="description" content="d" />',
    '<meta property="og:title" content="Clip" />',
    '<meta property="og:description" content="d" />',
    `<meta property="og:url" content="${ORIGIN}/" />`,
  ].join('\n'),
);

describe('template pages', () => {
  it('lists every template under at least one occasion', () => {
    const listed = new Set(templatesByOccasion('vi').flatMap((g) => g.templates.map((t) => t.id)));
    expect([...listed].sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
  });

  it('relates a template only to others sharing an occasion', () => {
    const spec = templateById('thay-co');
    for (const other of relatedTemplates(spec)) {
      expect(other.id).not.toBe(spec.id);
      expect(other.occasions.some((o) => spec.occasions.includes(o))).toBe(true);
    }
  });

  it('writes one page per template plus the index, each with its own head and text in #root', () => {
    const pages = seoPages();
    expect(pages.map((p) => p.file)).toEqual(['mau/index.html', ...TEMPLATES.map((t) => `mau/${t.id}/index.html`)]);
    const page = pages.find((p) => p.file === 'mau/thay-co/index.html');
    if (!page) throw new Error('no page');
    const html = pageHtml(INDEX, ORIGIN, page.head, page.body);
    expect(html).toContain('<title>Mẫu video Tri ân thầy cô 20/11 miễn phí · Clip</title>');
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/mau/thay-co" />`);
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/mau/thay-co" />`);
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/tpl/themes/thay-co/thumb.webp" />`);
    expect(html).toMatch(/<div id="root"><main[^>]*>.*<h1>Mẫu video Tri ân thầy cô 20\/11 miễn phí<\/h1>/);
    expect(html).toContain('href="/tao?t=thay-co"');
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it("puts the template's poster in place of the app's link preview, once", () => {
    const withPreview = INDEX.replace(
      '</head>',
      [
        `<meta property="og:image" content="${ORIGIN}/og-image.png" />`,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        `<meta name="twitter:image" content="${ORIGIN}/og-image.png" />`,
        '</head>',
      ].join('\n'),
    );
    const page = seoPages().find((p) => p.file === 'mau/tet/index.html');
    if (!page) throw new Error('no page');
    const html = pageHtml(withPreview, ORIGIN, page.head, page.body);
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/tpl/themes/tet/thumb.webp" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${ORIGIN}/tpl/themes/tet/thumb.webp" />`);
    expect(html).not.toContain('og:image:width');
    const index = seoPages().find((p) => p.file === 'mau/index.html');
    if (!index) throw new Error('no index');
    expect(pageHtml(withPreview, ORIGIN, index.head, index.body)).toContain(`<meta property="og:image" content="${ORIGIN}/og-image.png" />`);
  });

  it('escapes the text it puts into HTML', () => {
    const html = pageHtml(INDEX, ORIGIN, { title: 'a "b" <c>', description: 'x & y', path: '/mau' }, '');
    expect(html).toContain('<title>a &quot;b&quot; &lt;c&gt; · Clip</title>');
    expect(html).toContain('content="x &amp; y"');
  });

  it('lists the public pages in the sitemap and points robots at it', () => {
    const xml = sitemapXml(ORIGIN);
    expect(xml).toContain(`<loc>${ORIGIN}/mau</loc>`);
    for (const spec of TEMPLATES) expect(xml).toContain(`<loc>${ORIGIN}${templatePagePath(spec)}</loc>`);
    expect(robotsTxt(ORIGIN)).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});
