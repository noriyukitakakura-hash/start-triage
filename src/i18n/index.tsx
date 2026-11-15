import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ja } from './ja';
import { en } from './en';
import { detectLocale } from './detect';
import type { Locale, Messages, TFunction, TParams, TranslationKey } from './types';
import { loadStoredLocale, patchSettings } from '@/lib/storage';

const MESSAGES: Record<Locale, Messages> = { ja, en };

/** `{name}` 形式のプレースホルダを置換する。未知のキーはそのまま残す */
export function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

export function translate(locale: Locale, key: TranslationKey, params?: TParams): string {
  // `Messages` 型が全ロケールのキー網羅を強制するため、未定義になり得ない
  // （実行時の網羅性は tests/i18n.spec.ts でも検証している）
  return interpolate(MESSAGES[locale][key], params);
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    detectLocale({
      stored: loadStoredLocale(),
      search: typeof window === 'undefined' ? null : window.location.search,
      navigatorLanguage: typeof navigator === 'undefined' ? null : navigator.language,
    }),
  );

  // docs/I18N.md §4: スクリーンリーダーの読み上げ言語を追従させる
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    patchSettings({ locale: next });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}

export { LOCALES } from './types';
export type { Locale, TranslationKey } from './types';
