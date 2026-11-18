import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/**
 * サービスワーカーを生成する小さなプラグイン（SPEC §4.5）。
 *
 * workbox を使わないのは、本アプリに必要なのが
 * 「数個の静的ファイルのプリキャッシュ」と「SPA のナビゲーション代替」だけで、
 * ビルドツリーを大きくするだけの要件がないため。
 * i18next やルーターを入れなかったのと同じ判断（docs/INFRA.md）。
 *
 * **キャッシュ名にビルドごとのハッシュを含める。** 名前が変わらないと
 * 古い index.html が永久に配信され、利用者の端末が更新不能になる。
 * `activate` で現行以外のキャッシュを必ず削除する。
 */
export interface SwPluginOptions {
  /** ビルド成果物に加えてプリキャッシュする public 配下のパス */
  extraAssets?: string[];
}

export function serviceWorkerPlugin(options: SwPluginOptions = {}): Plugin {
  const extraAssets = options.extraAssets ?? [];

  return {
    name: 'triage-start:service-worker',
    apply: 'build',
    // Vite の HTML プラグインより後に走らせる。そうしないと index.html が
    // まだ bundle に無く、その内容を版の算出に含められない
    enforce: 'post',

    generateBundle(_outputOptions, bundle) {
      const emitted = Object.keys(bundle)
        // index.html は '/' として入れる。同じ内容を二重に持たない
        .filter((name) => name !== 'index.html')
        .map((name) => `/${name}`);
      const precache = [...new Set(['/', ...emitted, ...extraAssets])].sort();

      /*
       * 版は「一覧」と「index.html の中身」の両方から作る。
       * 一覧だけだと、資産のハッシュが変わらず HTML だけ変えた場合
       * （meta タグの修正など）に名前が変わらず、古い HTML が残り続ける。
       */
      // Rollup の型では常に存在することになっているが、プラグインの順序次第で
      // まだ出力されていないことがある。欠けていても版の算出を止めない
      const html = bundle['index.html'] as (typeof bundle)[string] | undefined;
      const htmlSource = html?.type === 'asset' ? String(html.source) : '';
      const version = createHash('sha256')
        .update(precache.join('\n'))
        .update(htmlSource)
        .digest('hex')
        .slice(0, 12);

      this.emitFile({ type: 'asset', fileName: 'sw.js', source: renderServiceWorker(precache, version) });
    },
  };
}

function renderServiceWorker(precache: readonly string[], version: string): string {
  return `/*
 * 自動生成。編集しないこと（vite.sw-plugin.ts が出力する）。
 *
 * 災害訓練は回線が不安定な会場で行われる。2回目以降は完全にオフラインで
 * 全機能が動くことを目標にしている（SPEC §4.5）。
 */
const CACHE = 'triage-start-${version}';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  // **ここで skipWaiting しない。** 操作中に新しい資産へ差し替わると、
  // 読み込み済みのコードと食い違う。切り替えは利用者の明示操作で行う
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // 利用者が更新を選んだときだけ切り替える
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ナビゲーションは常に index.html を返す。SPA のどのパスでも起動できるようにする
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((cached) => cached ?? fetch(request).catch(() => caches.match('/'))),
    );
    return;
  }

  // 資産はファイル名にハッシュが付いているのでキャッシュ優先でよい
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
`;
}
