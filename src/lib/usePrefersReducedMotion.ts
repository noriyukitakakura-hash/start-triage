import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** jsdom や matchMedia 未実装環境でも落ちないようにする */
function matchMediaSafe(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(QUERY);
  } catch {
    return null;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  const mql = matchMediaSafe();
  if (mql === null) return () => undefined;
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  return matchMediaSafe()?.matches ?? false;
}

/**
 * 利用者が「動きを減らす」設定を有効にしているか。
 *
 * 動きだけで情報を伝えてはならない（SPEC §5.3）。実測モードは
 * これが true のとき呼吸数を数値へフォールバックし、その旨を画面に表示する
 * （docs/OBSERVATION.md §3.5）。
 *
 * OS 側でいつでも切り替えられるため、`useSyncExternalStore` で変更に追従する。
 */
export function usePrefersReducedMotion(): boolean {
  // 第3引数はサーバー描画時のフォールバック。本アプリはSSRしないが型の要求を満たす
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
