/**
 * サービスワーカーの登録と更新（SPEC §4.5）。
 *
 * 災害訓練は回線が不安定な会場で行われる。2回目以降は完全にオフラインで
 * 全機能が動くことを目標にしている。
 *
 * **更新は利用者の明示操作で行う。** 10問チャレンジの最中に資産が差し替わると
 * 読み込み済みのコードと食い違い、計測中の記録も失われる。
 * 新しい版が用意できたことだけを伝え、切り替えは本人に委ねる。
 */

export type UpdateListener = (updateAvailable: boolean) => void;

let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<UpdateListener>();

function notify(): void {
  for (const listener of listeners) listener(waitingWorker !== null);
}

export function onUpdateAvailable(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(waitingWorker !== null);
  return () => listeners.delete(listener);
}

/** 待機中の版へ切り替える。切り替わると自動的に再読み込みされる */
export function applyUpdate(): void {
  waitingWorker?.postMessage('SKIP_WAITING');
}

function track(registration: ServiceWorkerRegistration): void {
  if (registration.waiting !== null) {
    waitingWorker = registration.waiting;
    notify();
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (installing === null) return;

    installing.addEventListener('statechange', () => {
      // controller が居ない＝初回インストール。更新ではないので知らせない
      if (installing.state === 'installed' && navigator.serviceWorker.controller !== null) {
        waitingWorker = installing;
        notify();
      }
    });
  });
}

export function registerServiceWorker(): void {
  // 開発サーバーには sw.js が無い。本番ビルドでのみ登録する
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      // sw.js 自体をブラウザにキャッシュさせない。更新が届かなくなるため
      .register('/sw.js', { updateViaCache: 'none' })
      .then(track)
      .catch(() => {
        // 登録できなくてもアプリは動く。オフライン対応が効かないだけ
      });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}
