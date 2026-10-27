import type { Locale } from '@clip/templates';
import { ApiError } from './api';
import { formatTime } from './format-time';
import type { MessageKey, Translate } from './i18n';

const KNOWN: ReadonlySet<string> = new Set([
  'daily-limit',
  'job-in-progress',
  'sign-in-required',
  'missing-field',
  'field-too-long',
  'too-few-photos',
  'too-many-photos',
  'photo-too-large',
  'photo-type',
  'photo-unreadable',
  'photo-too-big',
  'photo-blank',
  'invalid-background',
  'server-busy',
  'too-many-requests',
]);

/** What to tell the person about a failed API call: the server's code in words, with its numbers filled in. */
export function errorMessage(error: unknown, t: Translate, locale: Locale, minPhotos = 1): string {
  if (!(error instanceof ApiError) || !KNOWN.has(error.code)) return t('error.generic');
  const key = `error.${error.code}` as MessageKey;
  if (error.code === 'daily-limit') {
    const resetAt = typeof error.extra.resetAt === 'string' ? error.extra.resetAt : new Date().toISOString();
    return t(key, { limit: Number(error.extra.limit ?? 5), time: formatTime(resetAt, locale) });
  }
  return t(key, { min: minPhotos });
}
