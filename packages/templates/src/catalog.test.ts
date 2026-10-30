import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_VARIANTS,
  backgroundFile,
  composeTemplateHtml,
  FORMAT_SIZES,
  compositionVariables,
  GROUP_TRACKS,
  MUSIC_GROUPS,
  pickTrack,
  previewTrack,
  SHARED_TRACKS,
  usesVideoBackground,
  VIDEO_BACKGROUND_FILE,
  CUC_CHOICES,
  fieldsFromQuery,
  isTemplateId,
  linkParams,
  LAYOUT_IDS,
  LAYOUTS,
  MAX_DURATION_SECONDS,
  normalizeText,
  OCCASIONS,
  parseBackground,
  parseFormat,
  STAR_CHOICES,
  TEMPLATE_IDS,
  TEMPLATES,
  templateById,
  validateInput,
  VIDEO_FORMATS,
  ZODIAC_CHOICES,
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

describe('parseBackground', () => {
  const birthday = templateById('chuc-mung');

  it('takes the first background when the job names none (old clients and jobs)', () => {
    for (const raw of [undefined, null, '']) expect(parseBackground(birthday, raw)).toBe(1);
  });

  it('accepts every index of the theme, as a number or as digits', () => {
    for (let n = 1; n <= birthday.backgrounds; n += 1) {
      expect(parseBackground(birthday, n)).toBe(n);
      expect(parseBackground(birthday, String(n))).toBe(n);
    }
  });

  it('refuses anything else', () => {
    for (const raw of [0, -1, 1.5, BACKGROUND_VARIANTS + 1, '0', '7', '01x', ' 2', '2.0', '-1', '1e0', 'bg-2.webp', '../bg', NaN, Infinity, true, {}, [2]]) {
      expect(parseBackground(birthday, raw), String(raw)).toBeNull();
    }
    expect(parseBackground(templateById('la-so'), 2)).toBeNull();
  });
});

describe('the birth chart template (la-so)', () => {
  const chart = { name: '', line1: 'Tuổi Mùi · Mệnh Thiên Đồng', line2: 'Mộc Tam Cục', reading: 'Hiền hòa.', animal: 'mui', star: 'thien-dong', cuc: 'moc-tam' };

  it('accepts whitelisted picture ids and no major star', () => {
    expect(validateInput('la-so', chart, 0)).toEqual({ ok: true, templateId: 'la-so', fields: chart });
    expect(validateInput('la-so', { ...chart, star: '' }, 0)).toMatchObject({ ok: true, fields: { star: '' } });
  });

  it('refuses ids outside the whitelist, paths included, and a missing animal or cục', () => {
    for (const [field, value] of [
      ['animal', 'cat'],
      ['animal', '../../etc/passwd'],
      ['star', 'tu vi'],
      ['star', 'tuvi'],
      ['cuc', 'moc'],
    ] as const) {
      expect(validateInput('la-so', { ...chart, [field]: value }, 0), `${field}=${value}`).toMatchObject({ ok: false });
    }
    expect(validateInput('la-so', { ...chart, animal: '' }, 0)).toEqual({ ok: false, error: 'missing-field', field: 'animal' });
    expect(validateInput('la-so', { ...chart, cuc: '' }, 0)).toEqual({ ok: false, error: 'missing-field', field: 'cuc' });
  });

  it('fills fields from a link, keeping only valid values as plain text', () => {
    const query = new URLSearchParams({
      t: 'la-so',
      animal: 'mui',
      star: 'thien-dong',
      cuc: 'nope',
      name: '  <b>Lan</b>\n',
      line1: 'Tuổi Mùi'.normalize('NFD'),
      line2: 'x'.repeat(61),
      reading: 'Hiền hòa.',
      birth: '1991-05-04',
    });
    expect(fieldsFromQuery(templateById('la-so'), query)).toEqual({
      animal: 'mui',
      star: 'thien-dong',
      name: '<b>Lan</b>',
      line1: 'Tuổi Mùi',
      reading: 'Hiền hòa.',
    });
  });

  it('reads a link’s query and #fragment together, the fragment winning', () => {
    const link = linkParams('?t=la-so&animal=mui&star=&cuc=moc-tam&line1=from-query', '#name=Lan&line1=Tu%E1%BB%95i+M%C3%B9i&reading=Hi%E1%BB%81n+h%C3%B2a.');
    expect(link.get('t')).toBe('la-so');
    expect(fieldsFromQuery(templateById('la-so'), link)).toEqual({ animal: 'mui', star: '', cuc: 'moc-tam', name: 'Lan', line1: 'Tuổi Mùi', reading: 'Hiền hòa.' });
    expect([...linkParams('', '')]).toEqual([]);
    expect(linkParams('?a=1', 'b=2').get('b')).toBe('2');
  });

  it('keeps an empty optional field from a link as a choice, but not an empty required one', () => {
    expect(fieldsFromQuery(templateById('la-so'), new URLSearchParams('star=&name=&animal=&line1='))).toEqual({ star: '', name: '' });
    expect(fieldsFromQuery(templateById('la-so'), new URLSearchParams(''))).toEqual({});
  });

  it('has a picture for every id it accepts', () => {
    const dir = path.join(PROJECT_DIR, 'themes', templateById('la-so').theme);
    const files = [
      'medallion.webp',
      ...ZODIAC_CHOICES.map((c) => `animal-${c.id}.webp`),
      ...STAR_CHOICES.map((c) => `star-${c.id}.webp`),
      ...CUC_CHOICES.map((c) => `cuc-${c.id}.webp`),
    ];
    for (const file of files) expect(existsSync(path.join(dir, file)), file).toBe(true);
    expect([ZODIAC_CHOICES.length, STAR_CHOICES.length, CUC_CHOICES.length]).toEqual([12, 14, 5]);
    for (const c of [...ZODIAC_CHOICES, ...STAR_CHOICES, ...CUC_CHOICES]) expect(c.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
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
    it(`${spec.id}: its theme pack is on disk, and every placeholder is filled`, () => {
      const dir = path.join(PROJECT_DIR, 'themes', spec.theme);
      const files = ['bg.webp', 'thumb.webp', 'theme.css', 'sticker-1.webp', 'sticker-2.webp', 'sticker-3.webp', ...(spec.layout === 'greeting' ? ['frame.webp'] : [])];
      for (const file of files) expect(existsSync(path.join(dir, file)), `${spec.theme}/${file}`).toBe(true);
      const html = composeTemplateHtml(readFileSync(path.join(PROJECT_DIR, 'layouts', `${spec.layout}.html`), 'utf8'), spec);
      expect(html).not.toContain('{{');
      for (const field of spec.fields.filter((f) => f.required)) expect(field.placeholder.vi && field.placeholder.en, field.id).toBeTruthy();
    });
  }

  it('maps photos to the photo variables in order, and the background to its index', () => {
    const vars = compositionVariables(templateById('chuc-mung'), { line1: 'a' }, ['photos/photo-1.jpg']);
    expect(vars).toEqual({ background: '1', line1: 'a', line2: '', line3: '', photo1: 'photos/photo-1.jpg', photo2: '', photo3: '', cues: '' });
    expect(compositionVariables(templateById('chuc-mung'), {}, [], 4).background).toBe('4');
  });
});

/** Width and height of a WebP file (lossy VP8, lossless VP8L or extended VP8X), from its header. */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${file} is not a WebP`);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`${file}: unknown WebP chunk ${chunk}`);
}

/** Largest background file accepted: the existing ones are 70–550 KB at cwebp -q 88. */
const MAX_BACKGROUND_BYTES = 600 * 1024;
/** Largest video background accepted: a few seconds of slow motion, looped, need not weigh more. */
const MAX_VIDEO_BACKGROUND_BYTES = 4 * 1024 * 1024;

describe('background variants', () => {
  it('every theme but the birth chart offers the full set', () => {
    for (const spec of TEMPLATES) expect(spec.backgrounds, spec.id).toBe(spec.id === 'la-so' ? 1 : BACKGROUND_VARIANTS);
  });

  for (const spec of TEMPLATES) {
    it(`${spec.id}: has exactly its ${spec.backgrounds} background(s), each a vertical WebP of a sane size`, () => {
      const dir = path.join(PROJECT_DIR, 'themes', spec.theme);
      const expected = Array.from({ length: spec.backgrounds }, (_, i) => backgroundFile(i + 1));
      const onDisk = readdirSync(dir).filter((f) => /^bg(-\d+)?\.webp$/.test(f));
      expect(onDisk.sort()).toEqual([...expected].sort());
      const first = webpSize(path.join(dir, 'bg.webp'));
      for (const file of expected) {
        const size = webpSize(path.join(dir, file));
        expect(size.height, file).toBeGreaterThan(size.width);
        // Variants are drawn at 9:16; the original may be 2:3 (the first twelve themes). Both cover the video.
        if (file !== 'bg.webp') expect(size, file).toEqual({ width: 864, height: 1536 });
        else expect(first.width).toBeGreaterThanOrEqual(864);
        const bytes = statSync(path.join(dir, file)).size;
        expect(bytes, file).toBeGreaterThan(20 * 1024);
        expect(bytes, file).toBeLessThanOrEqual(MAX_BACKGROUND_BYTES);
      }
    });
  }

});

describe('music', () => {
  const trackFile = (track: string): string => path.join(PROJECT_DIR, 'assets', 'music', `${track}.m4a`);

  it('every template belongs to a music group, and every group has templates', () => {
    for (const spec of TEMPLATES) expect(MUSIC_GROUPS, spec.id).toContain(spec.musicGroup);
    for (const group of MUSIC_GROUPS) expect(TEMPLATES.some((t) => t.musicGroup === group), group).toBe(true);
  });

  it('lists only tracks that are on disk, with ids safe to put in a path, each in one group', () => {
    const own = MUSIC_GROUPS.flatMap((group): readonly string[] => GROUP_TRACKS[group]);
    for (const track of [...SHARED_TRACKS, ...own]) {
      expect(track).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(existsSync(trackFile(track)), track).toBe(true);
    }
    expect(new Set([...SHARED_TRACKS, ...own]).size).toBe(SHARED_TRACKS.length + own.length);
  });

  /** The fixed track of every template before music groups: what each keeps until its group has tracks. */
  const FIXED_TRACKS: Readonly<Record<string, string>> = {
    'chuc-mung': 'fetch-dance',
    'thay-co': 'good-fellow',
    'tet': 'fetch-dance',
    'giang-sinh': 'bicycle',
    'tinh-yeu': 'chillin-poupi',
    'dam-cuoi': 'good-fellow',
    'tot-nghiep': 'fetch-dance',
    'khai-truong': 'bicycle',
    'ke-nhanh': 'bicycle',
    'chuyen-di': 'good-fellow',
    'trich-dan': 'chillin-poupi',
    'cam-on': 'chillin-poupi',
    'phu-nu-8-3': 'chillin-poupi',
    'phu-nu-20-10': 'good-fellow',
    'thieu-nhi': 'fetch-dance',
    'trung-thu': 'bicycle',
    'valentine': 'chillin-poupi',
    'vu-lan': 'good-fellow',
    'ngay-cua-me': 'good-fellow',
    'halloween': 'fetch-dance',
    'quoc-khanh': 'bicycle',
    'tan-gia': 'bicycle',
    'day-thang': 'chillin-poupi',
    'mung-tho': 'good-fellow',
    'thang-chuc': 'fetch-dance',
    'ky-niem-cuoi': 'chillin-poupi',
    'thu-cung': 'fetch-dance',
    'khuyen-mai': 'fetch-dance',
    'mon-an': 'bicycle',
    'ban-hang': 'bicycle',
    'tuyen-dung': 'good-fellow',
    'su-kien': 'fetch-dance',
    'cam-trai': 'good-fellow',
    'chao-buoi-sang': 'bicycle',
    'chuc-ngu-ngon': 'chillin-poupi',
    'dong-vien': 'fetch-dance',
    'xin-loi': 'chillin-poupi',
    'la-so': 'chillin-poupi',
  };

  it('a template whose group has no tracks of its own keeps its fixed track, in the preview and in every video', () => {
    expect(Object.keys(FIXED_TRACKS)).toEqual([...TEMPLATE_IDS]);
    for (const spec of TEMPLATES) {
      const own: readonly string[] = GROUP_TRACKS[spec.musicGroup];
      if (own.length > 0) continue;
      expect(spec.music, spec.id).toBe(FIXED_TRACKS[spec.id]);
      expect(previewTrack(spec), spec.id).toBe(spec.music);
      for (let i = 0; i < 20; i += 1) expect(pickTrack(spec, `job-${i}`), spec.id).toBe(spec.music);
    }
  });

  it('within a group’s own tracks, picks the same track for the same seed and spreads videos over all of them', () => {
    const spec = templateById('chuc-mung');
    const own = ['bicycle', 'good-fellow', 'chillin-poupi'] as const;
    const picks = Array.from({ length: 200 }, (_, i) => pickTrack(spec, `job-${i}`, own));
    for (const [i, track] of picks.entries()) {
      expect(own).toContain(track);
      expect(pickTrack(spec, `job-${i}`, own)).toBe(track);
    }
    expect(new Set(picks).size).toBe(own.length);
    const id = '6f1c2a4e-1b7d-4c1e-9a55-0d3a8e2b7c10';
    expect(pickTrack(spec, id, own)).toBe(pickTrack(spec, id, [...own]));
    expect(pickTrack(spec, id, [])).toBe(spec.music);
  });

  it('puts the chosen track in the composition, and the preview track without a choice', () => {
    const spec = templateById('trich-dan');
    const html = readFileSync(path.join(PROJECT_DIR, 'layouts', `${spec.layout}.html`), 'utf8');
    for (const music of SHARED_TRACKS) expect(composeTemplateHtml(html, spec, '9:16', { music })).toContain(`src="assets/music/${music}.m4a"`);
    expect(composeTemplateHtml(html, spec)).toContain(`src="assets/music/${previewTrack(spec)}.m4a"`);
  });

  // Turned on once the occasion tracks are generated and listed in GROUP_TRACKS: each group should then have at
  // least two of its own. Skipped until then rather than met with placeholder files.
  it.skip('every group has at least two tracks of its own', () => {
    for (const group of MUSIC_GROUPS) expect(GROUP_TRACKS[group].length, group).toBeGreaterThanOrEqual(2);
  });
});

/** The four-character type of an ISO base media file (MP4): `ftyp` right after the first box size. */
function isMp4(file: string): boolean {
  return readFileSync(file).toString('ascii', 4, 8) === 'ftyp';
}

describe('video backgrounds', () => {
  for (const spec of TEMPLATES) {
    it(`${spec.id}: ships ${VIDEO_BACKGROUND_FILE} exactly when the catalog says so`, () => {
      const file = path.join(PROJECT_DIR, 'themes', spec.theme, VIDEO_BACKGROUND_FILE);
      expect(existsSync(file), `${spec.theme}/${VIDEO_BACKGROUND_FILE}`).toBe(spec.videoBackground);
      if (spec.videoBackground) {
        expect(isMp4(file)).toBe(true);
        expect(statSync(file).size).toBeLessThanOrEqual(MAX_VIDEO_BACKGROUND_BYTES);
      }
    });
  }

  for (const layout of LAYOUT_IDS) {
    const html = readFileSync(path.join(PROJECT_DIR, 'layouts', `${layout}.html`), 'utf8');
    const base = TEMPLATES.find((t) => t.layout === layout);
    if (!base) throw new Error(`no template on ${layout}`);
    const still = { ...base, videoBackground: false };
    const moving = { ...base, videoBackground: true };

    it(`${layout}: without a video background the composition is the picture, as before`, () => {
      const out = composeTemplateHtml(html, still);
      expect(out).toContain(`<img id="bg" src="themes/${base.theme}/bg.webp"`);
      expect(out).not.toContain('<video');
    });

    for (const format of VIDEO_FORMATS) {
      it(`${layout} ${format}: the first background plays the video, with the picture as poster`, () => {
        const out = composeTemplateHtml(html, moving, format);
        expect(out).not.toContain('<img id="bg"');
        expect(out).toContain(
          `<div id="motion"><video id="bg" src="themes/${base.theme}/${VIDEO_BACKGROUND_FILE}" poster="themes/${base.theme}/bg.webp" muted playsinline loop data-start="0" data-duration="${base.durationSeconds}"`,
        );
        expect(out.match(/<video /g)).toHaveLength(1);
        // hyperframes refuses timed media inside a timed element: the video's layer sits right before the stage.
        expect(out).toMatch(/<\/video><\/div>\s*<div id="stage"/);
        if (format !== '9:16') expect(out).toContain('#stage, #motion { inset: auto;');
      });
    }

    it(`${layout}: another chosen background is the picture, without the video`, () => {
      for (let n = 2; n <= BACKGROUND_VARIANTS; n += 1) {
        expect(usesVideoBackground(moving, n)).toBe(false);
        expect(composeTemplateHtml(html, moving, '9:16', { background: n })).toBe(composeTemplateHtml(html, still, '9:16', { background: n }));
      }
      expect(usesVideoBackground(moving)).toBe(true);
      expect(usesVideoBackground(still)).toBe(false);
    });
  }
});

describe('video formats', () => {
  it('reads a format: none is 9:16, anything outside the list is refused', () => {
    expect(parseFormat(undefined)).toBe('9:16');
    expect(parseFormat('')).toBe('9:16');
    for (const format of VIDEO_FORMATS) expect(parseFormat(format)).toBe(format);
    for (const raw of ['16:9', '1x1', ' 1:1', '4:5 ', 1, {}, ['1:1']]) expect(parseFormat(raw)).toBeNull();
  });

  for (const layout of LAYOUT_IDS) {
    const html = readFileSync(path.join(PROJECT_DIR, 'layouts', `${layout}.html`), 'utf8');
    const spec = TEMPLATES.find((t) => t.layout === layout);
    if (!spec) throw new Error(`no template on ${layout}`);

    it(`${layout}: 9:16 is the layout as drawn`, () => {
      expect(composeTemplateHtml(html, spec, '9:16')).toBe(composeTemplateHtml(html, spec));
      expect(composeTemplateHtml(html, spec)).not.toContain('id="backdrop"');
    });

    for (const format of ['4:5', '1:1'] as const) {
      it(`${layout}: ${format} sizes the frame and scales the 9:16 stage over a blurred backdrop`, () => {
        const { width, height } = FORMAT_SIZES[format];
        const out = composeTemplateHtml(html, spec, format);
        expect(out).toContain(`data-width="${width}" data-height="${height}"`);
        expect(out).toContain(`content="width=${width}, height=${height}"`);
        expect(out).toContain(`html, body { width: ${width}px; height: ${height}px;`);
        expect(out).toContain(`transform: scale(${height / 1920})`);
        expect(out).toContain(`<img id="backdrop" src="themes/${spec.theme}/bg.webp"`);
        expect(out).not.toContain('data-height="1920"');
      });
    }
  }
});
