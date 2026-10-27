import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '@clip/templates';
import { DICTIONARIES, type MessageKey } from './messages';

export type { MessageKey };
export const LOCALES: readonly Locale[] = ['vi', 'en'];
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { vi: 'Tiếng Việt', en: 'English' };
const STORAGE_KEY = 'clip.locale';

export type Translate = (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string;

/** Fills `{name}` placeholders. */
export function format(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

export function translator(locale: Locale): Translate {
  return (key, params) => format(DICTIONARIES[locale][key], params);
}

/** `?lang=` first (links from other apps), then the saved choice, then Vietnamese. */
function initialLocale(): Locale {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'vi' || fromUrl === 'en') return fromUrl;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    // Storage blocked (private mode): the default applies.
  }
  return 'vi';
}

interface I18n {
  readonly locale: Locale;
  readonly t: Translate;
  setLocale(locale: Locale): void;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved: the choice holds for this visit.
    }
  }, []);
  const value = useMemo(() => ({ locale, t: translator(locale), setLocale }), [locale, setLocale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside I18nProvider');
  return value;
}
