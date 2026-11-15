import type { Locale } from '@/i18n/types';
import type { RrPresentation } from './storage';

/**
 * X への投稿（SPEC §2.5 / docs/I18N.md §7）。
 *
 * **Web Intent を使う。** APIキー・OAuth・サーバーが不要で、
 * バックエンドを持たない方針（docs/INFRA.md §1）と整合する。
 *
 * **タイムはクライアント計測であり改ざん可能。** 自己申告の共有に限定し、
 * ランキングは実装しない（SPEC §1.7）。
 *
 * X の仕様変更に備え、URL の組み立てをこのモジュールに隔離している。
 */

const INTENT_ENDPOINT = 'https://x.com/intent/post';

export interface SharePayload {
  /** 投稿本文（改行を含む） */
  text: string;
  /** カンマ区切りのハッシュタグ（`#` は付けない） */
  hashtags: string;
  locale: Locale;
  /** アプリのURL。実行中のオリジンを使う */
  origin: string;
}

/**
 * 投稿を開くURLを組み立てる。
 *
 * URL に `?lang=` を付けるのは、投稿を見た人が**投稿者と同じ言語**で
 * 開けるようにするため（docs/I18N.md §7）。
 */
export function buildShareUrl(payload: SharePayload): string {
  const url = new URL(INTENT_ENDPOINT);
  url.searchParams.set('text', payload.text);
  url.searchParams.set('url', `${payload.origin}/?lang=${payload.locale}`);
  url.searchParams.set('hashtags', payload.hashtags);
  return url.toString();
}

/** 現在のオリジン。ローカル・プレビュー・本番のどれでも正しいURLを共有できる */
export function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/**
 * 投稿画面を新しいタブで開く。
 * `noopener,noreferrer` は、開いた先から元のページを操作されないようにするため。
 */
export function openShare(payload: SharePayload): void {
  window.open(buildShareUrl(payload), '_blank', 'noopener,noreferrer');
}

/** 投稿文に使うモード名の翻訳キー */
export function shareModeKey(presentation: RrPresentation): 'share.mode.numeric' | 'share.mode.observed' {
  return presentation === 'observed' ? 'share.mode.observed' : 'share.mode.numeric';
}
