/*
 * clipSeo: what search engines read without running the app. The build writes the public template pages as HTML
 * files (`mau/index.html`, `mau/<template>/index.html`): the app's index.html with the page's title, description,
 * canonical address and preview image, and the page's text already in #root (React replaces it on load). Plus
 * sitemap.xml and robots.txt. nginx serves `$uri/index.html` before falling back to the app.
 */
import { TEMPLATES, thumbnailPath, type TemplateSpec } from '@clip/templates';
import type { Plugin } from 'vite';
import { DICTIONARIES } from './src/messages.ts';
import {
  createPath,
  relatedTemplates,
  templatePageDescription,
  templatePagePath,
  templatePageTitle,
  templatesByOccasion,
  templatesIndexDescription,
  templatesIndexTitle,
  TEMPLATES_PATH,
} from './src/seo/template-pages.ts';

const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (value: string): string => value.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);

interface PageHead {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly image?: string;
}

/** The pages are written in Vietnamese, the app's default language; the app's own words for the buttons. */
const vi = DICTIONARIES.vi;

const thumb = (spec: TemplateSpec): string => `/tpl/${thumbnailPath(spec)}`;

function card(spec: TemplateSpec): string {
  return `<li><a class="template-card" href="${templatePagePath(spec)}"><img class="template-thumb" src="${thumb(spec)}" width="240" height="360" alt="" loading="lazy" /><b>${esc(spec.name.vi)}</b></a></li>`;
}

function indexBody(): string {
  const groups = templatesByOccasion('vi')
    .map((g) => `<section class="stack"><h2>${esc(g.name)}</h2><ul class="template-cards">${g.templates.map(card).join('')}</ul></section>`)
    .join('');
  return `<main class="page container stack-lg"><section class="stack"><h1>${esc(templatesIndexTitle('vi'))}</h1><p class="lead">${esc(templatesIndexDescription('vi'))}</p></section>${groups}<p><a class="btn btn-primary btn-lg" href="/tao">${esc(vi['intro.start'])}</a></p></main>`;
}

function templateBody(spec: TemplateSpec): string {
  const related = relatedTemplates(spec);
  return [
    '<main class="page container stack-lg">',
    `<p class="muted small"><a href="${TEMPLATES_PATH}">${esc(vi['templates.all'])}</a></p>`,
    `<section class="template-landing"><img class="template-thumb template-landing-thumb" src="${thumb(spec)}" width="240" height="360" alt="" />`,
    `<div class="stack"><h1>${esc(templatePageTitle(spec, 'vi'))}</h1><p class="lead">${esc(templatePageDescription(spec, 'vi'))}</p>`,
    `<p><a class="btn btn-primary btn-lg" href="${createPath(spec)}">${esc(vi['templates.make'])}</a></p></div></section>`,
    related.length > 0 ? `<section class="stack"><h2>${esc(vi['templates.related'])}</h2><ul class="template-cards">${related.map(card).join('')}</ul></section>` : '',
    '</main>',
  ].join('');
}

function replaceOnce(html: string, pattern: RegExp, to: string, what: string): string {
  if (!pattern.test(html)) throw new Error(`clip-seo: index.html has no ${what}`);
  return html.replace(pattern, () => to);
}

/** index.html with the page's head and its text in #root. */
export function pageHtml(indexHtml: string, origin: string, head: PageHead, body: string): string {
  const url = `${origin}${head.path}`;
  let html = indexHtml;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${esc(head.title)} · Clip</title>`, '<title>');
  html = replaceOnce(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(head.description)}" />`, 'description');
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(head.title)}" />`, 'og:title');
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(head.description)}" />`, 'og:description');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`, 'og:url');
  const extra = [`<link rel="canonical" href="${url}" />`];
  if (head.image) {
    // The page's own picture replaces the app's link preview, whose size no longer applies.
    const image = `${origin}${head.image}`;
    html = html.replace(/\s*<meta property="og:image:(width|height)" content="[^"]*" \/>/g, '');
    html = html.replace(/<meta (property="og:image"|name="twitter:image") content="[^"]*" \/>/g, (_match, attr: string) => `<meta ${attr} content="${image}" />`);
    if (!html.includes('<meta property="og:image" ')) extra.push(`<meta property="og:image" content="${image}" />`);
  }
  html = replaceOnce(html, /<\/head>/, `    ${extra.join('\n    ')}\n  </head>`, '</head>');
  return replaceOnce(html, /<div id="root"><\/div>/, `<div id="root">${body}</div>`, '#root');
}

/** The public pages: path (without the leading slash) of the HTML file → head and body. */
export function seoPages(): { file: string; head: PageHead; body: string }[] {
  return [
    {
      file: 'mau/index.html',
      head: { title: templatesIndexTitle('vi'), description: templatesIndexDescription('vi'), path: TEMPLATES_PATH },
      body: indexBody(),
    },
    ...TEMPLATES.map((spec) => ({
      file: `mau/${spec.id}/index.html`,
      head: { title: templatePageTitle(spec, 'vi'), description: templatePageDescription(spec, 'vi'), path: templatePagePath(spec), image: thumb(spec) },
      body: templateBody(spec),
    })),
  ];
}

export function sitemapXml(origin: string): string {
  const paths = ['/', TEMPLATES_PATH, ...TEMPLATES.map(templatePagePath)];
  const urls = paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(origin: string): string {
  return `User-agent: *\nDisallow: /api/\nDisallow: /auth/\nDisallow: /video\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function clipSeo(origin: string): Plugin {
  return {
    name: 'clip-seo',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (index?.type !== 'asset' || typeof index.source !== 'string') throw new Error('clip-seo: no index.html in the bundle');
      for (const page of seoPages()) this.emitFile({ type: 'asset', fileName: page.file, source: pageHtml(index.source, origin, page.head, page.body) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(origin) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(origin) });
    },
  };
}
