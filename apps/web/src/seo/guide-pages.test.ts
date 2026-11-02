import { describe, expect, it } from 'vitest';
import { isTemplateId, templateById } from '@clip/templates';
import nginxSite from '../../../../infra/nginx/clip.hoandat.com.conf?raw';
import indexHtml from '../../index.html?raw';
import { pageHtml, robotsTxt, seoPages, sitemapXml } from '../../vite-seo';
import { GUIDE_IDS, GUIDE_PATHS, GUIDES, guideAt } from './guide-pages';

/*
 * What the build writes for each guide page (dist/<path>/index.html), read as a crawler would, without running any
 * script; then the sitemap, robots.txt and the nginx rule that serves those files.
 */
const ORIGIN = 'https://clip.example.com';
const INDEX = indexHtml.replace(
  '<!-- brand-tags -->',
  [
    '<title>Clip</title>',
    '<meta name="description" content="d" />',
    '<meta property="og:title" content="Clip" />',
    '<meta property="og:description" content="d" />',
    `<meta property="og:url" content="${ORIGIN}/" />`,
    `<meta property="og:image" content="${ORIGIN}/og-image.png" />`,
  ].join('\n'),
);

function builtPage(path: string): string {
  const page = seoPages(ORIGIN).find((p) => p.file === `${path.slice(1)}/index.html`);
  if (!page) throw new Error(`no page for ${path}`);
  return pageHtml(INDEX, ORIGIN, page.head, page.body);
}

const tag = (html: string, pattern: RegExp): string => pattern.exec(html)?.[1] ?? '';
const JSON_LD = /<script type="application\/ld\+json">(.*?)<\/script>/;

const CASES = [
  { path: GUIDE_PATHS.birthday, title: 'Làm video sinh nhật từ ảnh miễn phí, có nhạc và lời chúc', h1: 'Làm video sinh nhật từ ảnh', cta: '/tao?t=chuc-mung' },
  { path: GUIDE_PATHS.vertical, title: 'Làm video dọc từ ảnh cho TikTok, Reels, Shorts miễn phí', h1: 'Làm video dọc từ ảnh cho TikTok, Reels', cta: '/tao?t=ke-nhanh' },
  { path: GUIDE_PATHS.tet, title: 'Video chúc Tết 2027 Đinh Mùi từ ảnh, miễn phí', h1: 'Video chúc Tết 2027', cta: '/tao?t=tet' },
] as const;

describe('guide pages as the build writes them', () => {
  it.each(CASES)('$path: its own head, the words, the call to action and the other guides in the HTML', ({ path, title, h1, cta }) => {
    const html = builtPage(path);
    expect(tag(html, /<title>([^<]*)<\/title>/)).toBe(`${title} · Clip`);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
    const description = tag(html, /<meta name="description" content="([^"]*)" \/>/);
    expect(description.length).toBeGreaterThan(100);
    expect(description.length).toBeLessThanOrEqual(170);
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${path}" />`);
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}${path}" />`);
    expect(tag(html, /<meta property="og:title" content="([^"]*)" \/>/)).toBe(title);
    expect(tag(html, /<meta property="og:image" content="([^"]*)" \/>/)).toMatch(new RegExp(`^${ORIGIN}/tpl/themes/.+/thumb\\.webp$`));

    const root = tag(html, /<div id="root">([\s\S]*)<\/div>\s*<script/);
    expect(root).toContain(`<h1>${h1}</h1>`);
    expect(root).toContain('lang="vi"');
    // Both calls to action open the create page on the guide's template.
    const ctas = [...root.matchAll(/<a class="btn btn-primary btn-lg"[^>]* href="([^"]+)"/g)].map((m) => m[1]);
    expect(ctas).toEqual([cta, cta]);
    expect(root).toContain('Câu hỏi thường gặp');
    const words = root.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    expect(words, `${path} words`).toBeGreaterThanOrEqual(300);
    expect(words).toBeLessThanOrEqual(600);
    for (const other of Object.values(GUIDE_PATHS).filter((p) => p !== path)) expect(root).toContain(`href="${other}"`);

    const json = tag(html, JSON_LD);
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toMatchObject({
      '@graph': [
        { '@type': 'WebPage', url: `${ORIGIN}${path}`, inLanguage: 'vi', potentialAction: { target: `${ORIGIN}${cta}` } },
        { '@type': 'FAQPage', mainEntity: expect.arrayContaining([expect.objectContaining({ '@type': 'Question' })]) },
      ],
    });
  });

  it('keeps JSON-LD to the guide pages', () => {
    expect(builtPage(GUIDE_PATHS.tet)).toMatch(JSON_LD);
    const template = seoPages(ORIGIN).find((p) => p.file === 'mau/tet/index.html');
    if (!template) throw new Error('no template page');
    expect(pageHtml(INDEX, ORIGIN, template.head, template.body)).not.toMatch(JSON_LD);
  });

  it('points every guide at real templates, its call to action at the first of its posters', () => {
    for (const id of GUIDE_IDS) {
      const guide = GUIDES[id];
      expect(guide.picks[0]).toBe(guide.template);
      for (const pick of guide.picks) expect(isTemplateId(pick)).toBe(true);
      expect(guide.faq.length).toBeGreaterThanOrEqual(3);
    }
    // The birthday and Tết guides promise the greeting layout's limits; the vertical one the quick layout's.
    expect(templateById(GUIDES.birthday.template).layout).toBe('greeting');
    expect(templateById(GUIDES.tet.template).layout).toBe('greeting');
    expect(templateById(GUIDES.vertical.template).layout).toBe('quick');
  });

  it('finds a guide by its path, with or without a trailing slash, and nothing elsewhere', () => {
    expect(guideAt(GUIDE_PATHS.tet)?.id).toBe('tet');
    expect(guideAt(`${GUIDE_PATHS.birthday}/`)?.id).toBe('birthday');
    expect(guideAt('/video-chuc-tet')).toBeNull();
    expect(guideAt('/')).toBeNull();
  });
});

describe('sitemap, robots.txt and nginx for the guide pages', () => {
  it('lists the three guides in the sitemap, right after the home page', () => {
    const locs = [...sitemapXml(ORIGIN).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.slice(0, 4)).toEqual([`${ORIGIN}/`, ...GUIDE_IDS.map((id) => `${ORIGIN}${GUIDES[id].path}`)]);
  });

  it('lets crawlers read the guides', () => {
    const disallowed = [...robotsTxt(ORIGIN).matchAll(/^Disallow: (.+)$/gm)].map((m) => m[1] ?? '');
    for (const path of Object.values(GUIDE_PATHS)) expect(disallowed.some((prefix) => path.startsWith(prefix))).toBe(false);
    // A person's own videos stay out of search, matched exactly.
    expect(disallowed).toContain('/video$');
    expect(robotsTxt(ORIGIN)).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('nginx serves <path>/index.html before falling back to the app', () => {
    const app = nginxSite.slice(nginxSite.indexOf('location / {'));
    expect(app).toMatch(/try_files \$uri \$uri\/index\.html \/index\.html;/);
  });
});
