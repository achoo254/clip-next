import { readPreferences, subscribePreferences } from '@achoo254/app-shell/preferences';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '@clip/templates';
import { brand } from './brand';
import { DICTIONARIES, type MessageKey } from './messages';

export type { MessageKey };
export const LOCALES = ['vi', 'en'] as const satisfies readonly Locale[];

/** Where the language was kept before the choice shared by every hoandat.com app (cookie `hd_lang`). */
export const LEGACY_LANG_KEY = 'clip.locale';

export const isLocale = (value: unknown): value is Locale => value === 'vi' || value === 'en';

export type Translate = (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string;

/** Fills `{name}` placeholders. */
export function format(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

export function translator(locale: Locale): Translate {
  return (key, params) => format(DICTIONARIES[locale][key], params);
}

/** The language picked in any hoandat.com app (or here before the shared choice), if any. */
function storedLocale(): Locale | undefined {
  return readPreferences({ domain: brand.primaryTenant.domain, legacyLangKey: LEGACY_LANG_KEY }).lang;
}

/** `?lang=` first (links from other apps), then the saved choice, then Vietnamese. */
export function initialLocale(search: string, stored: Locale | undefined): Locale {
  const fromUrl = new URLSearchParams(search).get('lang');
  if (isLocale(fromUrl)) return fromUrl;
  return stored ?? 'vi';
}

interface I18n {
  readonly locale: Locale;
  readonly t: Translate;
  /** Shows the app in `locale`; the footer's language switch has already stored the choice. */
  setLocale(locale: Locale): void;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [locale, setLocale] = useState<Locale>(() => initialLocale(window.location.search, storedLocale()));
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  // A language picked in another app's tab shows here when this tab is viewed again. Only a change counts, so a
  // `?lang=` link keeps its language until someone picks one.
  useEffect(() => {
    let last = storedLocale();
    return subscribePreferences(() => {
      const next = storedLocale();
      if (next === undefined || next === last) return;
      last = next;
      setLocale(next);
    });
  }, []);
  const value = useMemo(() => ({ locale, t: translator(locale), setLocale }), [locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside I18nProvider');
  return value;
}
