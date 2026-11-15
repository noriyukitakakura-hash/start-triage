# インフラ / サーバ構成

- ドメイン: `start.keiku-labo.space`
- 結論: **サーバは構築しない。静的ホスティング + DNS のみ。月額 ¥0（ドメイン年額のみ）**
- 文書バージョン: 0.1 / 2026-11-15

---

## 1. 結論と根拠

本アプリに**オリジンサーバは不要**。仕様(SPEC.md §4.1)の時点で以下が確定しているため。

| 要件 | 状況 | サーバが必要か |
|---|---|---|
| ログイン / ユーザー管理 | なし | 不要 |
| データ永続化 | localStorage（端末内） | 不要 |
| 症例生成・判定 | クライアント側の純関数 | 不要 |
| Xへの投稿 | Web Intent（URL遷移のみ。OAuth不要） | 不要 |
| ランキング | **v1では非実装**（クライアント計測は改ざん可能、SPEC §1.7） | 不要 |
| オフライン動作 | PWA（Service Worker） | 不要 |

よって最も安く、最も壊れにくい構成は「動かすサーバを持たない」こと。
VPSやコンテナを置くと、金額（月¥500〜1,000）以上に
**OSパッチ・nginx設定・証明書更新・死活監視**という継続的な時間コストが発生する。静的SPAに対してこれは純損失。

---

## 2. 推奨構成: Cloudflare Pages + Cloudflare DNS

```
GitHub  (repo: triage-start)
  │
  ├── PR 作成 ──► GitHub Actions
  │                 typecheck / lint / vitest
  │                 （generator の不変条件テスト 10,000回 を含む）
  │                 └─► 失敗なら main にマージ不可（ブランチ保護）
  │
  └── main へ push ──► Cloudflare Pages（Git連携・設定ほぼゼロ）
                         npm ci && npm run build  →  dist/
                         ├─ Production : https://start.keiku-labo.space
                         └─ Preview    : https://<hash>.triage-start.pages.dev （PRごとに自動）

Cloudflare DNS  (zone: keiku-labo.space)
  └── CNAME  start  →  triage-start.pages.dev   (Proxied / オレンジ雲)
         └─ TLS証明書は Cloudflare が自動発行・自動更新
```

**テストのgateはGitHub Actions、配信はCloudflare Pages** に分ける。
`judge()` の正しさが製品価値そのものなので、テスト未通過のコードを本番へ出さない構造が必要。
一方で `wrangler` のAPIトークン管理までやると手間が増えるため、デプロイはPagesのGit連携に任せる。
この分担なら両方とも無料枠内で、秘密情報の管理もゼロ。

### Cloudflare Pages を選ぶ理由
1. **転送量が無制限・無課金。** 他の無料枠はおおむね100GB/月の上限があり、
   超過時は停止または従量課金になる。訓練イベントで一斉アクセスが来ても事故らない。
2. サブドメインのTLS証明書を自動発行・自動更新（作業ゼロ、費用ゼロ）。
3. プレビューデプロイが無制限。PRごとにURLが出るので、医療側レビューを実機で回せる。
4. **privateリポジトリでもGit連携が無料。** GitHub Pagesはprivateだと有料。
5. 将来APIが必要になったら Pages Functions / Workers が同一プロジェクトに同居でき、無料枠10万req/日。
6. Cloudflare Web Analytics が無料・Cookieless。個人情報を取得しない方針(SPEC §4.1)と整合する。
7. ドメインをCloudflare Registrarに置けば、更新料がマークアップなしの原価。

### 他候補との比較
| 候補 | 月額 | 転送量 | 評価 |
|---|---|---|---|
| **Cloudflare Pages** | ¥0 | 無制限 | **推奨。**ビルド500回/月、同時ビルド1（本件には十分） |
| GitHub Pages | ¥0 | 100GB/月（ソフト） | 可。ただし無料でカスタムドメインを使うにはpublicリポジトリが必要 |
| Netlify Free | ¥0 | 100GB/月 | 可。超過時の挙動に注意 |
| Vercel Hobby | ¥0 | 100GB/月 | **不適。**ToS上Hobbyは商用利用不可。将来収益化の余地を潰す |
| S3 + CloudFront | ¥数十〜 | 従量 | ¥0にならない。ACM・OAC・バケットポリシーの設定コストも高い |
| VPS（さくら/Lightsail等） | ¥500〜1,000 | — | **非推奨。**静的SPAに常時起動サーバは不要。運用の時間コストが最大の損 |

---

## 3. 費用内訳

| 項目 | 料金 |
|---|---|
| ドメイン `keiku-labo.space` | **年額のみ**（下記注意） |
| ホスティング（Cloudflare Pages Free） | ¥0 |
| TLS証明書 | ¥0（自動発行・自動更新） |
| DNS（Cloudflare Free） | ¥0 |
| CDN / DDoS防御 | ¥0（Pagesに内包） |
| CI（GitHub Actions） | ¥0（publicは無制限 / privateでも月2,000分で十分） |
| アクセス解析（Cloudflare Web Analytics・任意） | ¥0 |
| **月額ランニング** | **¥0** |

> **注意: `.space` は初年度の割引額と更新料の差が大きいTLD。**
> 取得前に**更新価格**を必ず確認すること。長期運用するなら
> Cloudflare Registrar（原価提供）への移管か、更新料の安いTLDへの変更を検討する余地がある。
> 本アプリはドメイン以外の費用が完全に¥0なので、実質の総コスト＝ドメイン更新料。

---

## 4. セットアップ手順

1. レジストラで `keiku-labo.space` を取得
2. Cloudflare にサイト追加 → 指示されたネームサーバをレジストラ側で設定（ゾーンをCloudflareへ）
3. Cloudflare Pages でプロジェクト作成（GitHubリポジトリ `triage-start` を接続）
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: `.node-version` に `22` を置いて固定（ビルド環境のドリフト防止）
4. Pages → Custom domains に `start.keiku-labo.space` を追加
   → CNAMEレコードが自動作成され、検証後にTLSが自動発行される
5. GitHub でブランチ保護: `main` への直接pushを禁止、Actionsのtypecheck/lint/testを必須チェックに設定

> ゾーンをCloudflareに置かない場合も、外部DNSで
> `start` の CNAME を `triage-start.pages.dev` に向ければカスタムドメインは機能する。
> ただしDNSもCloudflareに寄せた方が設定箇所が1つで済み、無料なので寄せることを推奨。

---

## 5. 配信設定（リポジトリに置くファイル）

### `public/_headers`
```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache

/*
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; manifest-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=()
```
- Viteがアセット名にハッシュを付けるため `/assets/*` は `immutable` で1年キャッシュして良い。
- **`index.html` と `sw.js` は `no-cache` が必須。**ここをキャッシュするとPWAの更新が配信されなくなる。
- 外部リソース（CDN・Webフォント・解析タグ・外部画像）をゼロにする方針なので `default-src 'self'` が成立する。
  Xへの投稿は `window.open` によるトップレベル遷移なので、CSPの `connect-src` / `form-action` の制約を受けない。
- `style-src` の `'unsafe-inline'` はVite/Tailwindが出す一部のインラインスタイル用。
  ビルド結果を確認して不要なら削除する。

### `public/_redirects`
```
/*  /index.html  200
```
SPAのクライアントルーティング用（200 rewrite。301ではない）。
これによりURLがハッシュなしのきれいな形になり、OGPのURL指定も素直になる。

---

## 6. 運用

- **監視**: 動かすサーバがないため死活監視は不要。必要ならCloudflare Web Analyticsで到達状況のみ確認。
- **ロールバック**: Pagesのデプロイ履歴から任意のビルドへ即時ロールバック可（無料）。
- **秘密情報**: なし。APIキー・DB接続情報・OAuthクレデンシャルを一切持たない構成（漏洩リスクがゼロ）。
- **個人情報**: 取得しない。Cookieも使わない。localStorageは端末内に留まり送信されない。
  → プライバシーポリシーは「情報を収集しない」旨の短い記載で足りる。
- **バックアップ**: 状態がGitリポジトリのみ。別途バックアップ不要。
- **依存関係の脆弱性**: `npm audit` を0件に保つ。本アプリはサーバを持たないため実行時攻撃面はないが、
  ビルド・テスト経路の汚染を防ぐため開発依存も対象とする。
  upstream に修正版がない場合は `package.json` の `overrides` でパッチ版へ固定し、
  理由と解除条件を README に記録する（現在: `minimatch` → GHSA-g3hv-75wg-m249）。

---

## 7. 将来ランキングを実装する場合（v1では非実装）

Cloudflare Workers + D1（いずれも無料枠あり）で同一プロジェクト内に増設できるため、構成の作り直しは不要。
ただし SPEC §1.7 の通り、クライアント計測の時間は改ざん可能である。
意味のあるランキングにするには

1. サーバが出題シードを発行する
2. 回答列と所要時間をサーバ側で検証する
3. 同一端末からの試行回数を制限する

が前提となり、実質的なバックエンド開発になる。
**v1では非実装の方針を維持する。**
