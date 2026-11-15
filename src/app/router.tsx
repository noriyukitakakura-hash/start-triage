import { useCallback, useSyncExternalStore } from 'react';

/**
 * 最小限の画面遷移（SPEC §2.1）。
 *
 * ルーティングライブラリを入れない。画面は4つしかなく、
 * 初回ロード 300KB 未満の目標（SPEC §4.5）に対して依存を増やす価値がない。
 *
 * History API を使う（ハッシュではない）。`public/_redirects` の 200 rewrite により
 * どのパスでも `index.html` が返るため、直接アクセスもリロードも動く。
 * 端末の戻るボタンが期待どおり働くことを優先している。
 */

export const ROUTES = ['/', '/learn', '/challenge', '/reference'] as const;
export type Route = (typeof ROUTES)[number];

export function isRoute(value: string): value is Route {
  return (ROUTES as readonly string[]).includes(value);
}

function currentPath(): Route {
  if (typeof window === 'undefined') return '/';
  const path = window.location.pathname;
  return isRoute(path) ? path : '/';
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener('popstate', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('popstate', onStoreChange);
  };
}

export function navigate(route: Route): void {
  // 言語指定などのクエリは引き継ぐ（docs/I18N.md §4）
  window.history.pushState(null, '', `${route}${window.location.search}`);
  notify();
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentPath, () => '/');
}

/** 画面遷移を行うハンドラ。ボタンの onClick にそのまま渡せる */
export function useNavigate(): (route: Route) => void {
  return useCallback((route: Route) => navigate(route), []);
}
