/**
 * The video templates: what each one asks for (text fields, photos), how long it lasts, and the validation of a
 * user's input against it. Browser-safe: the web app builds its form and preview from this, the server validates
 * with it, the worker turns a job into composition variables with it. The compositions themselves are HTML files
 * under project/ (see project.ts).
 */

export type Locale = 'vi' | 'en';
export type Localized = Readonly<Record<Locale, string>>;

export const TEMPLATE_IDS = ['chuc-mung', 'ke-nhanh', 'trich-dan'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface TextField {
  /** Composition variable id. */
  readonly id: string;
  readonly label: Localized;
  readonly placeholder: Localized;
  readonly maxLength: number;
  readonly required: boolean;
}

export interface TemplateSpec {
  readonly id: TemplateId;
  readonly name: Localized;
  readonly description: Localized;
  /** Length of the rendered video, in seconds (the composition root's data-duration). */
  readonly durationSeconds: number;
  readonly photos: { readonly min: number; readonly max: number };
  readonly fields: readonly TextField[];
}

/** The longest video a template may last: renders on the shared server take about 6 s per second of video. */
export const MAX_DURATION_SECONDS = 20;
/** Photos per video, and their composition variable ids in order. */
export const MAX_PHOTOS = 3;
export const PHOTO_VARIABLES = ['photo1', 'photo2', 'photo3'] as const;

const line = (n: number, vi: string, en: string, required: boolean, maxLength = 60): TextField => ({
  id: `line${n}`,
  label: { vi: `Dòng ${n}`, en: `Line ${n}` },
  placeholder: { vi, en },
  maxLength,
  required,
});

const point = (n: number, vi: string, en: string, required: boolean): TextField => ({
  id: `point${n}`,
  label: { vi: `Ý ${n}`, en: `Point ${n}` },
  placeholder: { vi, en },
  maxLength: 80,
  required,
});

export const TEMPLATES: readonly TemplateSpec[] = [
  {
    id: 'chuc-mung',
    name: { vi: 'Chúc mừng', en: 'Celebrate' },
    description: {
      vi: 'Sinh nhật, ngày lễ: ba dòng chúc, một đến ba ảnh, pháo giấy và nhạc vui.',
      en: 'Birthdays and holidays: three lines of wishes, one to three photos, confetti and cheerful music.',
    },
    durationSeconds: 12,
    photos: { min: 1, max: 3 },
    fields: [
      line(1, 'Chúc mừng sinh nhật!', 'Happy birthday!', true),
      line(2, 'Tuổi mới thật nhiều niềm vui', 'Wishing you a year of joy', true),
      line(3, 'Yêu thương thật nhiều!', 'With lots of love!', true),
    ],
  },
  {
    id: 'ke-nhanh',
    name: { vi: 'Kể nhanh', en: 'Quick list' },
    description: {
      vi: 'Một tiêu đề và 3–5 ý, mỗi ý một khung, kiểu video ngắn. Ảnh không bắt buộc.',
      en: 'A title and 3–5 points, one frame each, short-video style. Photos are optional.',
    },
    durationSeconds: 18,
    photos: { min: 0, max: 3 },
    fields: [
      { id: 'title', label: { vi: 'Tiêu đề', en: 'Title' }, placeholder: { vi: '3 mẹo ngủ ngon', en: '3 tips for better sleep' }, maxLength: 50, required: true },
      point(1, 'Tắt màn hình trước khi ngủ 30 phút', 'Screens off 30 minutes before bed', true),
      point(2, 'Giữ phòng mát và tối', 'Keep the room cool and dark', true),
      point(3, 'Đi ngủ cùng một giờ mỗi tối', 'Go to bed at the same time', true),
      point(4, 'Ý thứ tư (không bắt buộc)', 'A fourth point (optional)', false),
      point(5, 'Ý thứ năm (không bắt buộc)', 'A fifth point (optional)', false),
    ],
  },
  {
    id: 'trich-dan',
    name: { vi: 'Trích dẫn', en: 'Quote' },
    description: {
      vi: 'Một câu nói lớn trên nền chuyển động chậm, kèm tên tác giả.',
      en: 'One big quote on a slowly moving background, with its author.',
    },
    durationSeconds: 10,
    photos: { min: 0, max: 0 },
    fields: [
      {
        id: 'quote',
        label: { vi: 'Câu trích dẫn', en: 'Quote' },
        placeholder: { vi: 'Hãy sống như thể ngày mai bạn sẽ chết…', en: 'Live as if you were to die tomorrow…' },
        maxLength: 160,
        required: true,
      },
      { id: 'author', label: { vi: 'Tác giả', en: 'Author' }, placeholder: { vi: 'Mahatma Gandhi', en: 'Mahatma Gandhi' }, maxLength: 40, required: false },
    ],
  },
];

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
