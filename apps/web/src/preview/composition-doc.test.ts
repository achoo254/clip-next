import { describe, expect, it } from 'vitest';
import { previewDocument } from './composition-doc';

const TEMPLATE = `<!doctype html><html lang="vi" data-composition-variables='[{"id":"line1","type":"string","default":"a"},{"id":"photo1","type":"string","default":""}]'>
<head><title>t</title></head><body><div id="root"></div><script src="scripts/common.js"></script></body></html>`;

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('previewDocument', () => {
  it('writes the values in as declared defaults, keeping the others', () => {
    const doc = parse(previewDocument(TEMPLATE, { line1: 'Chúc mừng <b>"x"</b>' }, 'https://clip.example'));
    const declared: unknown = JSON.parse(doc.documentElement.getAttribute('data-composition-variables') ?? '');
    expect(declared).toEqual([
      { id: 'line1', type: 'string', default: 'Chúc mừng <b>"x"</b>' },
      { id: 'photo1', type: 'string', default: '' },
    ]);
  });

  it('puts the base and the runtime before the template scripts, adding no inline script', () => {
    const doc = parse(previewDocument(TEMPLATE, {}, 'https://clip.example'));
    expect(doc.head.firstElementChild?.outerHTML).toBe('<base href="https://clip.example/tpl/">');
    const scripts = [...doc.querySelectorAll('script')].map((s) => s.getAttribute('src'));
    expect(scripts).toEqual(['https://clip.example/tpl/hyperframe.runtime.js', 'scripts/common.js']);
    expect([...doc.querySelectorAll('script')].every((s) => s.textContent === '')).toBe(true);
  });

  it('keeps user text out of the markup itself', () => {
    const html = previewDocument(TEMPLATE, { line1: '</script><script>alert(1)</script>' }, 'https://clip.example');
    expect(parse(html).querySelectorAll('script')).toHaveLength(2);
  });
});
