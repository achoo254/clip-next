import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compositionVariables, MAX_DURATION_SECONDS, normalizeText, PHOTO_VARIABLES, TEMPLATES, templateById, validateInput } from './catalog';
import { PROJECT_DIR } from './project';

describe('validateInput', () => {
  const quick = { title: 'T', point1: 'a', point2: 'b', point3: 'c' };

  it('accepts a complete input and fills optional fields with empty text', () => {
    expect(validateInput('ke-nhanh', quick, 0)).toEqual({
      ok: true,
      templateId: 'ke-nhanh',
      fields: { ...quick, point4: '', point5: '' },
    });
  });

  it('refuses unknown templates, unknown fields, missing and too long text, and wrong photo counts', () => {
    expect(validateInput('nope', quick, 0)).toEqual({ ok: false, error: 'unknown-template' });
    expect(validateInput('ke-nhanh', { ...quick, extra: 'x' }, 0)).toEqual({ ok: false, error: 'invalid-fields' });
    expect(validateInput('ke-nhanh', { ...quick, title: 1 }, 0)).toEqual({ ok: false, error: 'invalid-fields' });
    expect(validateInput('ke-nhanh', [], 0)).toEqual({ ok: false, error: 'invalid-fields' });
    expect(validateInput('ke-nhanh', { ...quick, point2: '   ' }, 0)).toEqual({ ok: false, error: 'missing-field', field: 'point2' });
    expect(validateInput('ke-nhanh', { ...quick, title: 'x'.repeat(51) }, 0)).toEqual({ ok: false, error: 'field-too-long', field: 'title' });
    expect(validateInput('chuc-mung', { line1: 'a', line2: 'b', line3: 'c' }, 0)).toEqual({ ok: false, error: 'too-few-photos' });
    expect(validateInput('chuc-mung', { line1: 'a', line2: 'b', line3: 'c' }, 4)).toEqual({ ok: false, error: 'too-many-photos' });
    expect(validateInput('trich-dan', { quote: 'q' }, 1)).toEqual({ ok: false, error: 'too-many-photos' });
  });

  it('counts Vietnamese characters once, however the keyboard composed them', () => {
    const decomposed = 'Chúc mừng'.normalize('NFD');
    expect(decomposed.length).toBeGreaterThan(9);
    expect(normalizeText(decomposed)).toBe('Chúc mừng');
    expect(normalizeText(' a\n\tb\u0000 ')).toBe('a b');
  });
});

describe('templates', () => {
  it('last at most 20 seconds', () => {
    for (const spec of TEMPLATES) expect(spec.durationSeconds).toBeLessThanOrEqual(MAX_DURATION_SECONDS);
  });

  for (const spec of TEMPLATES) {
    it(`${spec.id}: the composition declares exactly the catalog's variables and duration`, () => {
      const html = readFileSync(path.join(PROJECT_DIR, `${spec.id}.html`), 'utf8');
      const declared = /data-composition-variables='([^']*)'/.exec(html)?.[1];
      if (!declared) throw new Error('no data-composition-variables');
      const ids = (JSON.parse(declared) as { id: string; type: string }[]).map((v) => v.id);
      expect(ids).toEqual(Object.keys(compositionVariables(spec, {}, [])));
      expect(html).toContain(`data-duration="${spec.durationSeconds}" data-width="1080" data-height="1920"`);
      if (spec.photos.max > 0) expect(ids).toEqual(expect.arrayContaining([...PHOTO_VARIABLES]));
    });
  }

  it('maps photos to the photo variables in order', () => {
    const vars = compositionVariables(templateById('chuc-mung'), { line1: 'a' }, ['photos/photo-1.jpg']);
    expect(vars).toEqual({ line1: 'a', line2: '', line3: '', photo1: 'photos/photo-1.jpg', photo2: '', photo3: '' });
  });
});
