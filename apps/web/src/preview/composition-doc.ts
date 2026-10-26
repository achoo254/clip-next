/**
 * The preview document of a composition: the template's HTML with the user's values written in as the declared
 * defaults of its `data-composition-variables` (what `getVariables()` returns when nothing overrides them), a
 * `<base>` so its scripts and assets load from /tpl/, and the hyperframes runtime in front of its own scripts.
 * Nothing inline is added, so the page's strict CSP (script-src 'self') also covers the preview frame.
 */

/** Where the web server serves the compositions' scripts and assets, and the runtime. */
export const TEMPLATE_BASE = '/tpl/';
export const RUNTIME_SRC = '/tpl/hyperframe.runtime.js';

interface VariableDeclaration {
  readonly id: string;
  readonly default?: unknown;
  readonly [key: string]: unknown;
}

function isDeclaration(value: unknown): value is VariableDeclaration {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

export function previewDocument(templateHtml: string, values: Readonly<Record<string, string>>, origin: string): string {
  const doc = new DOMParser().parseFromString(templateHtml, 'text/html');
  const root = doc.documentElement;
  const declared: unknown = JSON.parse(root.getAttribute('data-composition-variables') ?? '[]');
  if (!Array.isArray(declared)) throw new Error('data-composition-variables is not an array');
  const merged = declared.filter(isDeclaration).map((d) => (d.id in values ? { ...d, default: values[d.id] } : d));
  root.setAttribute('data-composition-variables', JSON.stringify(merged));

  // An absolute base: the frame is about:srcdoc, which has no URL of its own to resolve relative paths against.
  const base = doc.createElement('base');
  base.href = new URL(TEMPLATE_BASE, origin).href;
  const runtime = doc.createElement('script');
  runtime.src = new URL(RUNTIME_SRC, origin).href;
  doc.head.prepend(base, runtime);
  return `<!doctype html>\n${root.outerHTML}`;
}
