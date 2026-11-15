import { isLocale, type Locale } from './types';

export const DEFAULT_LOCALE: Locale = 'ja';

export interface DetectInput {
  /** localStorage に保存済みの明示選択。最優先 */
  stored: string | null | undefined;
  /** `?lang=en` のようなクエリ文字列（`location.search` そのまま） */
  search: string | null | undefined;
  /** `navigator.language` */
  navigatorLanguage: string | null | undefined;
}

/**
 * 初期言語の決定（docs/I18N.md §4）
 * 1. 保存済みの明示選択  2. URLクエリ `?lang=`  3. navigator.language が ja 系  4. en
 */
export function detectLocale(input: DetectInput): Locale {
  if (isLocale(input.stored)) return input.stored;

  if (input.search) {
    const lang = new URLSearchParams(input.search).get('lang');
    if (isLocale(lang)) return lang;
  }

  const nav = input.navigatorLanguage?.toLowerCase();
  if (nav?.startsWith('ja')) return 'ja';
  if (nav) return 'en';

  return DEFAULT_LOCALE;
}
