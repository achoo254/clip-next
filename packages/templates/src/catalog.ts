/**
 * The video templates: what each one asks for (text fields, photos), how long it lasts, and the validation of a
 * user's input against it. Browser-safe: the web app builds its form and preview from this, the server validates
 * with it, the worker turns a job into composition variables with it. A template is a layout (the composition, under
 * project/layouts/) dressed in a theme (AI-drawn art and colours, under project/themes/); see project.ts.
 */

export type Locale = 'vi' | 'en';
export type Localized = Readonly<Record<Locale, string>>;

export interface TextField {
  /** Composition variable id. */
  readonly id: string;
  readonly label: Localized;
  readonly placeholder: Localized;
  readonly maxLength: number;
  readonly required: boolean;
}

/**
 * A layout is one composition (`project/layouts/<id>.html` + `project/scripts/<id>.js`): its timing, its text
 * fields and photo slots. Every template is a layout dressed in a theme; the variable contract belongs to the layout.
 */
export const LAYOUT_IDS = ['greeting', 'quick', 'quote'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

interface FieldShape {
  readonly id: string;
  readonly label: Localized;
  readonly maxLength: number;
  readonly required: boolean;
}

export interface LayoutSpec {
  readonly id: LayoutId;
  /** Length of the rendered video, in seconds (the composition root's data-duration). */
  readonly durationSeconds: number;
  readonly photos: { readonly min: number; readonly max: number };
  readonly fields: readonly FieldShape[];
}

const line = (n: number): FieldShape => ({ id: `line${n}`, label: { vi: `Dòng ${n}`, en: `Line ${n}` }, maxLength: 60, required: true });
const point = (n: number, required: boolean): FieldShape => ({ id: `point${n}`, label: { vi: `Ý ${n}`, en: `Point ${n}` }, maxLength: 80, required });

export const LAYOUTS: Readonly<Record<LayoutId, LayoutSpec>> = {
  greeting: { id: 'greeting', durationSeconds: 12, photos: { min: 1, max: 3 }, fields: [line(1), line(2), line(3)] },
  quick: {
    id: 'quick',
    durationSeconds: 18,
    photos: { min: 0, max: 3 },
    fields: [
      { id: 'title', label: { vi: 'Tiêu đề', en: 'Title' }, maxLength: 50, required: true },
      point(1, true),
      point(2, true),
      point(3, true),
      point(4, false),
      point(5, false),
    ],
  },
  quote: {
    id: 'quote',
    durationSeconds: 10,
    photos: { min: 0, max: 0 },
    fields: [
      { id: 'quote', label: { vi: 'Câu trích dẫn', en: 'Quote' }, maxLength: 160, required: true },
      { id: 'author', label: { vi: 'Tác giả', en: 'Author' }, maxLength: 40, required: false },
    ],
  },
};

/** Occasions the template picker filters by. */
export const OCCASIONS = ['celebrate', 'holiday', 'love', 'share'] as const;
export type Occasion = (typeof OCCASIONS)[number];
export const OCCASION_NAMES: Readonly<Record<Occasion, Localized>> = {
  celebrate: { vi: 'Chúc mừng', en: 'Celebrate' },
  holiday: { vi: 'Lễ, Tết', en: 'Holidays' },
  love: { vi: 'Yêu thương', en: 'Love' },
  share: { vi: 'Chia sẻ', en: 'Share' },
};

/** Music tracks under project/assets/music (CC0, assets/CREDITS.md). */
export type MusicTrack = 'fetch-dance' | 'bicycle' | 'chillin-poupi' | 'good-fellow';

/**
 * Template ids are stored on jobs: never rename one. The first three predate themes (they were the three original
 * templates) and keep their ids.
 */
export const TEMPLATE_IDS = [
  'chuc-mung',
  'thay-co',
  'tet',
  'giang-sinh',
  'tinh-yeu',
  'dam-cuoi',
  'tot-nghiep',
  'khai-truong',
  'ke-nhanh',
  'chuyen-di',
  'trich-dan',
  'cam-on',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface TemplateSpec {
  readonly id: TemplateId;
  readonly layout: LayoutId;
  /** Art pack under project/themes/<theme>/ (AI-drawn background, stickers, frame) and its colours (theme.css). */
  readonly theme: string;
  readonly music: MusicTrack;
  readonly occasions: readonly Occasion[];
  readonly name: Localized;
  readonly description: Localized;
  readonly durationSeconds: number;
  readonly photos: { readonly min: number; readonly max: number };
  readonly fields: readonly TextField[];
}

interface ThemeEntry {
  readonly id: TemplateId;
  readonly layout: LayoutId;
  readonly theme: string;
  readonly music: MusicTrack;
  readonly occasions: readonly Occasion[];
  readonly name: Localized;
  readonly description: Localized;
  /** Sample text per field id, shown as placeholder and in the preview until the person types. */
  readonly samples: Readonly<Record<string, Localized>>;
}

const ENTRIES: readonly ThemeEntry[] = [
  {
    id: 'chuc-mung',
    layout: 'greeting',
    theme: 'sinh-nhat',
    music: 'fetch-dance',
    occasions: ['celebrate'],
    name: { vi: 'Sinh nhật', en: 'Birthday' },
    description: { vi: 'Bóng bay, quà và bánh kem: ba dòng chúc, một đến ba ảnh.', en: 'Balloons, gifts and cake: three lines of wishes, one to three photos.' },
    samples: {
      line1: { vi: 'Chúc mừng sinh nhật!', en: 'Happy birthday!' },
      line2: { vi: 'Tuổi mới thật nhiều niềm vui', en: 'Wishing you a year of joy' },
      line3: { vi: 'Yêu thương thật nhiều!', en: 'With lots of love!' },
    },
  },
  {
    id: 'thay-co',
    layout: 'greeting',
    theme: 'thay-co',
    music: 'good-fellow',
    occasions: ['holiday'],
    name: { vi: 'Tri ân thầy cô 20/11', en: "Teachers' Day" },
    description: { vi: 'Hoa, sách và áo dài cho Ngày Nhà giáo Việt Nam.', en: "Flowers, books and ao dai for Vietnam's Teachers' Day." },
    samples: {
      line1: { vi: 'Kính chúc thầy cô', en: 'Dear teacher' },
      line2: { vi: 'Luôn mạnh khoẻ và hạnh phúc', en: 'Wishing you health and happiness' },
      line3: { vi: 'Con cảm ơn thầy cô!', en: 'Thank you for everything!' },
    },
  },
  {
    id: 'tet',
    layout: 'greeting',
    theme: 'tet',
    music: 'fetch-dance',
    occasions: ['holiday'],
    name: { vi: 'Năm mới, Tết', en: 'Lunar New Year' },
    description: { vi: 'Đỏ vàng, hoa mai, hoa đào và lồng đèn.', en: 'Red and gold, apricot and peach blossoms, lanterns.' },
    samples: {
      line1: { vi: 'Chúc mừng năm mới!', en: 'Happy New Year!' },
      line2: { vi: 'An khang thịnh vượng', en: 'Peace and prosperity' },
      line3: { vi: 'Vạn sự như ý!', en: 'May all your wishes come true!' },
    },
  },
  {
    id: 'giang-sinh',
    layout: 'greeting',
    theme: 'giang-sinh',
    music: 'bicycle',
    occasions: ['holiday'],
    name: { vi: 'Giáng sinh', en: 'Christmas' },
    description: { vi: 'Thông xanh, tuyết và quà Noel.', en: 'Pine trees, snow and Christmas presents.' },
    samples: {
      line1: { vi: 'Giáng sinh an lành!', en: 'Merry Christmas!' },
      line2: { vi: 'Ấm áp bên gia đình', en: 'Warm days with family' },
      line3: { vi: 'Năm mới thật rực rỡ!', en: 'And a bright New Year!' },
    },
  },
  {
    id: 'tinh-yeu',
    layout: 'greeting',
    theme: 'tinh-yeu',
    music: 'chillin-poupi',
    occasions: ['love'],
    name: { vi: 'Tình yêu, kỷ niệm', en: 'Love & anniversary' },
    description: { vi: 'Hoa hồng và trái tim cho người thương.', en: 'Roses and hearts for someone you love.' },
    samples: {
      line1: { vi: 'Gửi người thương', en: 'To my love' },
      line2: { vi: 'Cảm ơn vì đã luôn bên anh', en: 'Thank you for always being there' },
      line3: { vi: 'Yêu em mỗi ngày!', en: 'I love you every day!' },
    },
  },
  {
    id: 'dam-cuoi',
    layout: 'greeting',
    theme: 'dam-cuoi',
    music: 'good-fellow',
    occasions: ['love', 'celebrate'],
    name: { vi: 'Đám cưới', en: 'Wedding' },
    description: { vi: 'Hoa trắng, nhẫn cưới và sắc vàng champagne.', en: 'White flowers, rings and champagne gold.' },
    samples: {
      line1: { vi: 'Chúc mừng hạnh phúc!', en: 'Congratulations!' },
      line2: { vi: 'Trăm năm tình viên mãn', en: 'A lifetime of love' },
      line3: { vi: 'Bạc đầu nghĩa phu thê!', en: 'Together forever!' },
    },
  },
  {
    id: 'tot-nghiep',
    layout: 'greeting',
    theme: 'tot-nghiep',
    music: 'fetch-dance',
    occasions: ['celebrate'],
    name: { vi: 'Tốt nghiệp', en: 'Graduation' },
    description: { vi: 'Mũ cử nhân, bằng và vòng nguyệt quế.', en: 'Caps, diplomas and laurel wreaths.' },
    samples: {
      line1: { vi: 'Chúc mừng tốt nghiệp!', en: 'Congratulations, graduate!' },
      line2: { vi: 'Bao năm cố gắng đã thành quả', en: 'All that hard work paid off' },
      line3: { vi: 'Bay thật cao nhé!', en: 'Now fly high!' },
    },
  },
  {
    id: 'khai-truong',
    layout: 'greeting',
    theme: 'khai-truong',
    music: 'bicycle',
    occasions: ['celebrate'],
    name: { vi: 'Khai trương, thành công', en: 'Grand opening' },
    description: { vi: 'Lẵng hoa, nơ đỏ và kim tuyến vàng.', en: 'Flower stands, red ribbons and gold confetti.' },
    samples: {
      line1: { vi: 'Chúc mừng khai trương!', en: 'Happy grand opening!' },
      line2: { vi: 'Hồng phát, đắt hàng', en: 'Wishing you great business' },
      line3: { vi: 'Thành công rực rỡ!', en: 'Every success!' },
    },
  },
  {
    id: 'ke-nhanh',
    layout: 'quick',
    theme: 'ke-nhanh',
    music: 'bicycle',
    occasions: ['share'],
    name: { vi: 'Kể nhanh', en: 'Quick list' },
    description: { vi: 'Tiêu đề và 3–5 ý, mỗi ý một khung, kiểu video ngắn. Ảnh không bắt buộc.', en: 'A title and 3–5 points, one frame each, short-video style. Photos optional.' },
    samples: {
      title: { vi: '3 mẹo ngủ ngon', en: '3 tips for better sleep' },
      point1: { vi: 'Tắt màn hình trước khi ngủ 30 phút', en: 'Screens off 30 minutes before bed' },
      point2: { vi: 'Giữ phòng mát và tối', en: 'Keep the room cool and dark' },
      point3: { vi: 'Đi ngủ cùng một giờ mỗi tối', en: 'Go to bed at the same time' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'chuyen-di',
    layout: 'quick',
    theme: 'chuyen-di',
    music: 'good-fellow',
    occasions: ['share'],
    name: { vi: 'Chuyến đi', en: 'Trip postcard' },
    description: { vi: 'Kiểu bưu thiếp: tên chuyến đi, 3–5 điều đáng nhớ và ảnh.', en: 'Postcard style: the trip, 3–5 highlights and photos.' },
    samples: {
      title: { vi: 'Hạ Long 3 ngày 2 đêm', en: 'Three days in Ha Long Bay' },
      point1: { vi: 'Ngủ đêm trên du thuyền giữa vịnh', en: 'A night on a boat in the bay' },
      point2: { vi: 'Chèo kayak qua hang Luồn', en: 'Kayaking through Luon cave' },
      point3: { vi: 'Hải sản tươi ở chợ đêm', en: 'Fresh seafood at the night market' },
      point4: { vi: 'Ý thứ tư (không bắt buộc)', en: 'A fourth point (optional)' },
      point5: { vi: 'Ý thứ năm (không bắt buộc)', en: 'A fifth point (optional)' },
    },
  },
  {
    id: 'trich-dan',
    layout: 'quote',
    theme: 'trich-dan',
    music: 'chillin-poupi',
    occasions: ['share'],
    name: { vi: 'Trích dẫn', en: 'Quote' },
    description: { vi: 'Một câu nói lớn trên bầu trời đêm, kèm tên tác giả.', en: 'One big quote on a twilight sky, with its author.' },
    samples: {
      quote: { vi: 'Hãy sống như thể ngày mai bạn sẽ chết, hãy học như thể bạn sẽ sống mãi.', en: 'Live as if you were to die tomorrow. Learn as if you were to live forever.' },
      author: { vi: 'Mahatma Gandhi', en: 'Mahatma Gandhi' },
    },
  },
  {
    id: 'cam-on',
    layout: 'quote',
    theme: 'cam-on',
    music: 'chillin-poupi',
    occasions: ['share', 'love'],
    name: { vi: 'Cảm ơn', en: 'Thank you' },
    description: { vi: 'Lời cảm ơn trên nền hoa màu nước.', en: 'A thank-you note on watercolour flowers.' },
    samples: {
      quote: { vi: 'Cảm ơn bạn vì đã luôn ở bên, những lúc vui cũng như lúc khó khăn.', en: 'Thank you for always being there, in good times and hard ones.' },
      author: { vi: 'Tên của bạn', en: 'Your name' },
    },
  },
];

export const TEMPLATES: readonly TemplateSpec[] = ENTRIES.map((entry) => {
  const layout = LAYOUTS[entry.layout];
  return {
    id: entry.id,
    layout: entry.layout,
    theme: entry.theme,
    music: entry.music,
    occasions: entry.occasions,
    name: entry.name,
    description: entry.description,
    durationSeconds: layout.durationSeconds,
    photos: layout.photos,
    fields: layout.fields.map((f) => ({ ...f, placeholder: entry.samples[f.id] ?? { vi: '', en: '' } })),
  };
});

/** The longest video a template may last: renders on the shared server take about 6 s per second of video. */
export const MAX_DURATION_SECONDS = 20;
/** Photos per video, and their composition variable ids in order. */
export const MAX_PHOTOS = 3;
export const PHOTO_VARIABLES = ['photo1', 'photo2', 'photo3'] as const;

/** Where a template's thumbnail is served (a small copy of its background, under the web app's /tpl/). */
export function thumbnailPath(spec: TemplateSpec): string {
  return `themes/${spec.theme}/thumb.webp`;
}

/**
 * A template's composition: its layout's HTML with the theme and music filled in (`{{theme}}`, `{{music}}`). The
 * worker renders this, `hyperframes check` checks it, the web preview plays it.
 */
export function composeTemplateHtml(layoutHtml: string, spec: TemplateSpec): string {
  return layoutHtml.replaceAll('{{theme}}', spec.theme).replaceAll('{{music}}', spec.music);
}

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && (TEMPLATE_IDS as readonly string[]).includes(value);
}

export function templateById(id: TemplateId): TemplateSpec {
  const spec = TEMPLATES.find((t) => t.id === id);
  if (!spec) throw new Error(`unknown template ${id}`);
  return spec;
}

/** Why an input was refused; stable codes the UI translates. */
export type InputError = 'unknown-template' | 'invalid-fields' | 'missing-field' | 'field-too-long' | 'too-few-photos' | 'too-many-photos';

export type InputResult =
  | { readonly ok: true; readonly templateId: TemplateId; readonly fields: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly error: InputError; readonly field?: string };

// Control characters (C0, DEL, C1), tabs and new lines included: a line of a video is one line of text.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * One line of user text as the video shows it: Unicode NFC (macOS and some keyboards send Vietnamese decomposed,
 * which would count double and may render badly), control characters replaced by spaces, spaces collapsed.
 */
export function normalizeText(value: string): string {
  return value.normalize('NFC').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks a job's text fields and photo count against its template. Unknown field ids are refused rather than
 * dropped, so a client out of step with the server notices.
 */
export function validateInput(templateId: unknown, fields: unknown, photoCount: number): InputResult {
  if (!isTemplateId(templateId)) return { ok: false, error: 'unknown-template' };
  const spec = templateById(templateId);
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) return { ok: false, error: 'invalid-fields' };
  const known = new Set(spec.fields.map((f) => f.id));
  const entries = Object.entries(fields);
  if (entries.some(([id, value]) => !known.has(id) || typeof value !== 'string')) return { ok: false, error: 'invalid-fields' };
  const given = new Map(entries.map(([id, value]) => [id, normalizeText(String(value))]));
  const clean: Record<string, string> = {};
  for (const field of spec.fields) {
    const value = given.get(field.id) ?? '';
    if (field.required && value === '') return { ok: false, error: 'missing-field', field: field.id };
    if ([...value].length > field.maxLength) return { ok: false, error: 'field-too-long', field: field.id };
    clean[field.id] = value;
  }
  if (photoCount < spec.photos.min) return { ok: false, error: 'too-few-photos' };
  if (photoCount > spec.photos.max) return { ok: false, error: 'too-many-photos' };
  return { ok: true, templateId, fields: clean };
}

/**
 * The composition variables of one render: every text field, then one variable per photo slot of the template
 * (the photo's URL or path, empty when there is none).
 */
export function compositionVariables(spec: TemplateSpec, fields: Readonly<Record<string, string>>, photos: readonly string[]): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const field of spec.fields) variables[field.id] = fields[field.id] ?? '';
  if (spec.photos.max > 0) {
    PHOTO_VARIABLES.forEach((id, index) => {
      variables[id] = photos[index] ?? '';
    });
  }
  return variables;
}
