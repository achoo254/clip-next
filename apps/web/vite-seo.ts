/*
 * clipSeo: what search engines read without running the app. The build writes the public template pages as HTML
 * files (`mau/index.html`, `mau/<template>/index.html`) and the guide pages (`<guide path>/index.html`, see
 * src/seo/guide-pages.ts): the app's index.html with the page's title, description, canonical address and preview
 * image, and the page's text already in #root (React replaces it on load). A guide page's text is its React component
 * rendered here, so crawlers read exactly what the app shows, plus its JSON-LD (WebPage and FAQPage). Plus
 * sitemap.xml and robots.txt. nginx serves `$uri/index.html` before falling back to the app.
 */
import { templateById, TEMPLATES, thumbnailPath, type TemplateSpec } from '@clip/templates';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import type { Plugin } from 'vite';
import { brand } from './src/brand.ts';
import { DICTIONARIES } from './src/messages.ts';
import { GuidePage } from './src/pages/guide-page.tsx';
import { GUIDE_IDS, GUIDES, guideStartPath, type Guide } from './src/seo/guide-pages.ts';
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
  /** schema.org data of the page, written as a JSON-LD data block. */
  readonly jsonLd?: Readonly<Record<string, unknown>>;
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
  if (head.jsonLd) {
    // A data block, not a script: the CSP (no inline script) does not apply to it. "<" is escaped inside the JSON so
    // no text can close the element.
    extra.push(`<script type="application/ld+json">${JSON.stringify(head.jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  html = replaceOnce(html, /<\/head>/, `    ${extra.join('\n    ')}\n  </head>`, '</head>');
  return replaceOnce(html, /<div id="root"><\/div>/, `<div id="root">${body}</div>`, '#root');
}

/** A guide page's text: its React component, inside the page frame #root gets before the app takes over. */
function guideBody(guide: Guide): string {
  const page = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [guide.path] }, createElement(GuidePage, { guide })));
  return `<main class="page container stack-lg">${page}</main>`;
}

/** schema.org data of a guide page: the page itself and its questions, for search results. */
export function guideJsonLd(guide: Guide, origin: string): Readonly<Record<string, unknown>> {
  const url = `${origin}${guide.path}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: guide.title,
        headline: guide.heading,
        description: guide.description,
        inLanguage: 'vi',
        datePublished: guide.datePublished,
        primaryImageOfPage: `${origin}${thumb(templateById(guide.template))}`,
        isPartOf: { '@type': 'WebSite', name: brand.appName, url: `${origin}/` },
        potentialAction: { '@type': 'Action', name: guide.cta, target: `${origin}${guideStartPath(guide)}` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        url,
        inLanguage: 'vi',
        mainEntity: guide.faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
      },
    ],
  };
}

/** The public pages: path (without the leading slash) of the HTML file → head and body. */
export function seoPages(origin: string): { file: string; head: PageHead; body: string }[] {
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
    ...GUIDE_IDS.map((id) => GUIDES[id]).map((guide) => ({
      file: `${guide.path.slice(1)}/index.html`,
      head: {
        title: guide.title,
        description: guide.description,
        path: guide.path,
        image: thumb(templateById(guide.template)),
        jsonLd: guideJsonLd(guide, origin),
      },
      body: guideBody(guide),
    })),
  ];
}

export function sitemapXml(origin: string): string {
  const paths = ['/', ...GUIDE_IDS.map((id) => GUIDES[id].path), TEMPLATES_PATH, ...TEMPLATES.map(templatePagePath)];
  const urls = paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** "/video" (a person's own videos) only: a bare prefix would also hide guide pages such as /video-chuc-tet-2027. */
export function robotsTxt(origin: string): string {
  return `User-agent: *\nDisallow: /api/\nDisallow: /auth/\nDisallow: /video$\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function clipSeo(origin: string): Plugin {
  return {
    name: 'clip-seo',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (index?.type !== 'asset' || typeof index.source !== 'string') throw new Error('clip-seo: no index.html in the bundle');
      for (const page of seoPages(origin)) this.emitFile({ type: 'asset', fileName: page.file, source: pageHtml(index.source, origin, page.head, page.body) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(origin) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(origin) });
    },
  };
}
