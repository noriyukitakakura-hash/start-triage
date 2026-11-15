import type { ja } from './ja';

export const LOCALES = ['ja', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** `ja.ts` のキーを正とする翻訳キー。存在しないキーの参照はコンパイルエラーになる */
export type TranslationKey = keyof typeof ja;

/** 各ロケールは `ja` と完全に同一のキー集合を持たなければならない */
export type Messages = Record<TranslationKey, string>;

export type TParams = Record<string, string | number>;
export type TFunction = (key: TranslationKey, params?: TParams) => string;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
