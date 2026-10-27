/**
 * The public template pages (`/mau` and `/mau/<template>`): their addresses and texts, shared by the React pages and
 * the static HTML the build writes for search engines (vite-seo.ts), so both say the same thing.
 */
import { OCCASION_NAMES, OCCASIONS, TEMPLATES, type Locale, type Occasion, type TemplateSpec } from '@clip/templates';

export const TEMPLATES_PATH = '/mau';

export function templatePagePath(spec: TemplateSpec): string {
  return `${TEMPLATES_PATH}/${spec.id}`;
}

/** Where the "make this video" button goes: the create page on this template. */
export function createPath(spec: TemplateSpec): string {
  return `/tao?t=${spec.id}`;
}

export function templatePageTitle(spec: TemplateSpec, locale: Locale): string {
  return locale === 'vi' ? `Mẫu video ${spec.name.vi} miễn phí` : `${spec.name.en} video template, free`;
}

export function templatePageDescription(spec: TemplateSpec, locale: Locale): string {
  return locale === 'vi'
    ? `${spec.description.vi} Gõ vài dòng, thêm ảnh, xem trước ngay và tải video MP4 dọc 9:16, 4:5 hoặc vuông. Miễn phí.`
    : `${spec.description.en} Type a few lines, add photos, preview it at once and download an MP4 in 9:16, 4:5 or square. Free.`;
}

export function templatesIndexTitle(locale: Locale): string {
  return locale === 'vi' ? 'Mẫu video chúc mừng, lễ Tết, kỷ niệm miễn phí' : 'Free video templates for greetings, holidays and more';
}

export function templatesIndexDescription(locale: Locale): string {
  return locale === 'vi'
    ? `${TEMPLATES.length} mẫu video vẽ bằng AI theo dịp: sinh nhật, 20/11, Tết, cưới, kỷ niệm, khai trương. Chọn mẫu, gõ chữ, thêm ảnh và tải MP4.`
    : `${TEMPLATES.length} AI-drawn video templates by occasion: birthdays, holidays, weddings, anniversaries, openings. Pick one, type, add photos, download the MP4.`;
}

export interface OccasionGroup {
  readonly occasion: Occasion;
  readonly name: string;
  readonly templates: readonly TemplateSpec[];
}

/** The templates by occasion, in the catalog's order; a template with several occasions shows under each. */
export function templatesByOccasion(locale: Locale): OccasionGroup[] {
  return OCCASIONS.map((occasion) => ({
    occasion,
    name: OCCASION_NAMES[occasion][locale],
    templates: TEMPLATES.filter((t) => t.occasions.includes(occasion)),
  })).filter((group) => group.templates.length > 0);
}

/** Up to `limit` other templates sharing an occasion with `spec`, in the catalog's order. */
export function relatedTemplates(spec: TemplateSpec, limit = 6): TemplateSpec[] {
  return TEMPLATES.filter((t) => t.id !== spec.id && t.occasions.some((o) => spec.occasions.includes(o))).slice(0, limit);
}
