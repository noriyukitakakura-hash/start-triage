import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PWA のビルド成果物を検証する（SPEC §4.5）。
 *
 * サービスワーカーはビルド時に生成されるため、dist を対象にする。
 * dist が無ければビルドしてから確認する。
 */
const DIST = join(process.cwd(), 'dist');

function ensureBuild(): void {
  if (existsSync(join(DIST, 'sw.js'))) return;
  execFileSync('npm', ['run', 'build'], { stdio: 'ignore' });
}

ensureBuild();

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
/** 注釈を除いた実行コード。語がコメントに出ただけで判定が揺れないようにする */
const swCode = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8')) as {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  icons: { src: string; sizes: string; purpose: string }[];
};

/** sw.js に埋め込まれたプリキャッシュ一覧 */
function precacheList(): string[] {
  const match = /const PRECACHE = (\[[\s\S]*?\]);/.exec(sw);
  expect(match, 'PRECACHE が見つからない').not.toBeNull();
  return JSON.parse((match as RegExpExecArray)[1] as string) as string[];
}

describe('サービスワーカーの生成', () => {
  it('ビルド成果物として出力される', () => {
    expect(existsSync(join(DIST, 'sw.js'))).toBe(true);
  });

  it('起動に必要な資産をすべてプリキャッシュする', () => {
    const precache = precacheList();

    // ナビゲーションの受け皿
    expect(precache).toContain('/');
    // 実際に出力された JS と CSS が含まれる
    const assets = /src="(\/assets\/[^"]+\.js)"/.exec(html);
    expect(assets, 'index.html から JS が引けない').not.toBeNull();
    expect(precache).toContain((assets as RegExpExecArray)[1]);
    expect(precache.some((p) => p.endsWith('.css'))).toBe(true);
  });

  it('アイコンとマニフェストを含む（インストール後もオフラインで表示できる）', () => {
    const precache = precacheList();
    expect(precache).toContain('/manifest.webmanifest');
    expect(precache).toContain('/icons/icon-192.png');
    expect(precache).toContain('/icons/icon-512.png');
  });

  it('OGP画像は含まない（クローラ向けで端末側には不要）', () => {
    expect(precacheList()).not.toContain('/og-image.png');
  });

  it('index.html を二重に持たない', () => {
    expect(precacheList()).not.toContain('/index.html');
  });
});

describe('サービスワーカーの更新の安全性', () => {
  it('キャッシュ名に版が入る（古い資産が残り続けない）', () => {
    expect(sw).toMatch(/const CACHE = 'triage-start-[0-9a-f]{12}'/);
  });

  it('activate で現行以外のキャッシュを削除する', () => {
    expect(swCode).toContain('caches.delete');
    expect(swCode).toContain('n !== CACHE');
  });

  it('install で skipWaiting しない（操作中に差し替えない）', () => {
    const installBlock = /addEventListener\('install'[\s\S]*?\}\);/.exec(swCode);
    expect(installBlock).not.toBeNull();
    expect((installBlock as RegExpExecArray)[0]).not.toContain('skipWaiting');
  });

  it('skipWaiting を呼ぶのはメッセージ受信時だけである', () => {
    const calls = [...swCode.matchAll(/skipWaiting/g)];
    expect(calls).toHaveLength(1);
    const messageBlock = /addEventListener\('message'[\s\S]*?\}\);/.exec(swCode);
    expect(messageBlock).not.toBeNull();
    expect((messageBlock as RegExpExecArray)[0]).toContain('skipWaiting');
  });

  it('利用者の明示操作でのみ切り替わる', () => {
    expect(swCode).toContain("event.data === 'SKIP_WAITING'");
  });
});

describe('サービスワーカーの取得規則', () => {
  it('GET 以外と他オリジンには介入しない', () => {
    expect(swCode).toContain("request.method !== 'GET'");
    expect(swCode).toContain('url.origin !== self.location.origin');
  });

  it('ナビゲーションは index.html を返す（SPAのどのパスでも起動できる）', () => {
    expect(swCode).toContain("request.mode === 'navigate'");
    expect(swCode).toContain("caches.match('/')");
  });
});

describe('マニフェスト', () => {
  it('インストールに必要な項目が揃っている', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('192 と 512 のアイコンと maskable を持つ', () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('参照するアイコンが実在する', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(join(DIST, icon.src.replace(/^\//, ''))), icon.src).toBe(true);
    }
  });
});

describe('CSP との両立（docs/INFRA.md §5）', () => {
  it('index.html にインラインスクリプトを入れない', () => {
    // script-src 'self' のまま運用するため。登録はバンドル内から行う
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/);
  });

  it('マニフェストとアイコンを宣言している', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('apple-touch-icon');
  });
});

describe('配信設定（public/_headers）', () => {
  const headers = readFileSync(join(DIST, '_headers'), 'utf8');

  it('sw.js とマニフェストをキャッシュさせない（更新が届かなくなる）', () => {
    expect(headers).toMatch(/\/sw\.js\s+Cache-Control: no-cache/);
    expect(headers).toMatch(/\/manifest\.webmanifest\s+Cache-Control: no-cache/);
  });

  it('ハッシュの付かないアイコンは長期固定にしない', () => {
    expect(headers).toContain('/icons/*');
    expect(headers).not.toMatch(/\/icons\/\*\s+Cache-Control: public, max-age=31536000/);
  });
});
