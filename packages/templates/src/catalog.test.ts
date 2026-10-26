import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  composeTemplateHtml,
  compositionVariables,
  isTemplateId,
  LAYOUT_IDS,
  LAYOUTS,
  MAX_DURATION_SECONDS,
  normalizeText,
  OCCASIONS,
  TEMPLATE_IDS,
  TEMPLATES,
  templateById,
  validateInput,
} from './catalog';
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
  it('last at most 20 seconds, have unique ids and a name in both languages', () => {
    for (const spec of TEMPLATES) {
      expect(spec.durationSeconds).toBeLessThanOrEqual(MAX_DURATION_SECONDS);
      expect(spec.name.vi && spec.name.en).toBeTruthy();
    }
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(TEMPLATES.map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
  });

  it('show sample text that a person could have typed (within each field limit)', () => {
    for (const spec of TEMPLATES) {
      for (const field of spec.fields) {
        for (const text of [field.placeholder.vi, field.placeholder.en]) expect([...text].length, `${spec.id}.${field.id}`).toBeLessThanOrEqual(field.maxLength);
      }
    }
  });

  it('leave no occasion filter empty', () => {
    for (const occasion of OCCASIONS) expect(TEMPLATES.some((t) => t.occasions.includes(occasion)), occasion).toBe(true);
  });

  it('keep the ids stored on existing jobs', () => {
    for (const id of ['chuc-mung', 'ke-nhanh', 'trich-dan']) expect(isTemplateId(id)).toBe(true);
  });

  for (const layout of LAYOUT_IDS) {
    it(`${layout}: the layout declares exactly its variables and duration`, () => {
      const html = readFileSync(path.join(PROJECT_DIR, 'layouts', `${layout}.html`), 'utf8');
      const declared = /data-composition-variables='([^']*)'/.exec(html)?.[1];
      if (!declared) throw new Error('no data-composition-variables');
      const ids = (JSON.parse(declared) as { id: string }[]).map((v) => v.id);
      const spec = TEMPLATES.find((t) => t.layout === layout);
      if (!spec) throw new Error(`no template uses ${layout}`);
      expect(ids).toEqual(Object.keys(compositionVariables(spec, {}, [])));
      expect(html).toContain(`data-duration="${LAYOUTS[layout].durationSeconds}" data-width="1080" data-height="1920"`);
    });
  }

  for (const spec of TEMPLATES) {
    it(`${spec.id}: its theme pack and music are on disk, and every placeholder is filled`, () => {
      const dir = path.join(PROJECT_DIR, 'themes', spec.theme);
      const files = ['bg.webp', 'thumb.webp', 'theme.css', 'sticker-1.webp', 'sticker-2.webp', 'sticker-3.webp', ...(spec.layout === 'greeting' ? ['frame.webp'] : [])];
      for (const file of files) expect(existsSync(path.join(dir, file)), `${spec.theme}/${file}`).toBe(true);
      expect(existsSync(path.join(PROJECT_DIR, 'assets', 'music', `${spec.music}.m4a`))).toBe(true);
      const html = composeTemplateHtml(readFileSync(path.join(PROJECT_DIR, 'layouts', `${spec.layout}.html`), 'utf8'), spec);
      expect(html).not.toContain('{{');
      for (const field of spec.fields.filter((f) => f.required)) expect(field.placeholder.vi && field.placeholder.en, field.id).toBeTruthy();
    });
  }

  it('maps photos to the photo variables in order', () => {
    const vars = compositionVariables(templateById('chuc-mung'), { line1: 'a' }, ['photos/photo-1.jpg']);
    expect(vars).toEqual({ line1: 'a', line2: '', line3: '', photo1: 'photos/photo-1.jpg', photo2: '', photo3: '' });
  });
});
