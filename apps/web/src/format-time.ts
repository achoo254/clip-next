import type { Locale } from '@clip/templates';

const INTL_LOCALES: Readonly<Record<Locale, string>> = { vi: 'vi-VN', en: 'en-GB', 'zh-CN': 'zh-CN' };

/** A date and time in Vietnam time (the app's limits and expiry follow Vietnamese days). */
export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
