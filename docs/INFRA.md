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

## 2. 構成: GitHub Actions から Cloudflare Pages へ配信

```
GitHub  (repo: start-triage)
  │
  ├── PR 作成 ──► verify
  │                 typecheck / lint / vitest / build
  │                 （generator の不変条件テスト 10,000回 を含む）
  │                 └─► 失敗なら main にマージ不可（ブランチ保護）
  │
  └── main へ push ──► verify ──► deploy
                         │          wrangler pages deploy dist
                         │          └─► https://start.keiku-labo.space
                         └─ dist を artifact で受け渡す

Cloudflare DNS  (zone: keiku-labo.space)
  └── start.keiku-labo.space  →  triage-start.pages.dev
         └─ TLS証明書は Cloudflare が自動発行・自動更新
```

**テストを通過したものだけが本番へ出る。** `judge()` の正しさが製品価値そのものであり、
テスト未通過のコードを配信してはならない。`verify` が落ちれば `deploy` は走らない。

**検証した成果物をそのまま配信する。** `verify` が作った `dist` を artifact で渡し、
`deploy` 側では再ビルドしない。再ビルドすると「テストを通したもの」と「配信するもの」が
別物になり得るため。

### Cloudflare の Git 連携を使わない理由

Cloudflare Pages の Git 連携は設定が楽だが、本プロジェクトでは採らない。

1. **既存プロジェクトを変換できない。** Direct Upload で作ったプロジェクトは
   Git 連携へ切り替えられず、新規作成とカスタムドメインの付け替えが要る。
   稼働中のドメインに数分のダウンタイムが生じる。
   > "If you choose Direct Upload, you cannot switch to Git integration later.
   > You will have to create a new project with Git integration to use automatic deployments."
2. **テストを配信の条件にしにくい。** Cloudflare 側のビルドはビルドコマンドの成否しか見ない。
   `npm run build` に `npm run test` を混ぜれば止められるが、失敗の切り分けが悪くなる。
   Actions なら「検証」と「配信」を別ジョブに分けたまま依存関係で縛れる。

### 必要な秘密情報

| 名前 | 用途 | 作り方 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | `wrangler pages deploy` の認証 | Cloudflare ダッシュボード → My Profile → API Tokens → Create Token → Custom token。権限は **Account / Cloudflare Pages / Edit** のみ |
| `CLOUDFLARE_ACCOUNT_ID` | 配信先アカウントの指定 | ダッシュボードのアカウント ID |

リポジトリは公開なので、アカウント ID も Secrets に置く（資格情報ではないが露出させない）。

```sh
gh secret set CLOUDFLARE_API_TOKEN  --repo noriyukitakakura-hash/start-triage
gh secret set CLOUDFLARE_ACCOUNT_ID --repo noriyukitakakura-hash/start-triage
```

**トークンは Pages の Edit 権限だけに絞る。** 漏洩しても配信先の差し替えに留まり、
DNS やゾーン設定には手が届かない。

手元からの手動配信（`npm run deploy`）は引き続き使える。
`wrangler login` の OAuth と Secrets のトークンは独立している。

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

   > **wrangler 4.162 時点の注意。** `wrangler pages project create` は Workers へ
   > 委譲しようとして失敗する。初回のみ `--force` を付けて従来の Pages 経路を使う:
   > `npx wrangler pages project create triage-start --production-branch=main --force`
   > プロジェクト作成後は `npm run deploy`（`wrangler pages deploy dist`）だけでよい。
   > カスタムドメインの追加用サブコマンドは存在しないため、ダッシュボードから行う。

   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: `.node-version` に `22` を置いて固定（ビルド環境のドリフト防止）
4. Pages → Custom domains に `start.keiku-labo.space` を追加
   → CNAMEレコードが自動作成され、検証後にTLSが自動発行される
   → **割り当て後、`index.html` の `og:url` / `og:image` / `canonical` を新しい正規URLへ切り替える。**
     OGPは配信中の実URLを指していなければリンクカードが壊れる。
     **2026-11-15 に割り当て済み。正規URLは `https://start.keiku-labo.space/`。**
     `triage-start.pages.dev` でも同じ内容が見えるため `canonical` で正規化している
5. GitHub Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録（§2 参照）
6. GitHub でブランチ保護: `main` への直接pushを禁止、`verify` を必須チェックに設定

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
- `style-src` の `'unsafe-inline'` は**必須**。呼吸アニメーションの周期（`animation-duration`）と
  振幅（`--breath-amp`）を症例ごとに `style` 属性で渡すため（`docs/OBSERVATION.md` §3.2）。
  CSP の `style-src` に指定した `'unsafe-inline'` はインラインの `style` 属性にも適用される。

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
- **PWA**: `vite.sw-plugin.ts` がビルド時にサービスワーカーを生成する。
  `vite-plugin-pwa`（workbox）は使っていない。本アプリに必要なのは
  「数個の静的ファイルのプリキャッシュ」と「SPA のナビゲーション代替」だけで、
  ビルドツリーを大きくするだけの要件がないため。i18next やルーターを
  入れなかったのと同じ判断。
  - キャッシュ名にビルドごとの版を含め、`activate` で現行以外を必ず削除する。
    名前が変わらないと古い `index.html` が永久に配信され、端末が更新不能になる
  - 版は「プリキャッシュ一覧」と「`index.html` の中身」の両方から算出する。
    一覧だけだと、資産のハッシュが変わらず HTML だけ変えた場合に版が据え置かれる
  - `install` では `skipWaiting` しない。操作中に資産が差し替わると
    読み込み済みのコードと食い違い、計測中の記録も失われる。
    切り替えは利用者の明示操作（`SKIP_WAITING` メッセージ）でのみ行う
  - 登録はバンドル内から行い、`index.html` にインラインスクリプトを入れない。
    CSP の `script-src 'self'` を緩めずに済ませるため
  - `sw.js` と `manifest.webmanifest` は `_headers` で `no-cache`。
    ここをキャッシュすると更新が届かなくなる
- **アイコン**: `public/icons/`（192・512・maskable 512）と `public/apple-touch-icon.png`。
  元データは `docs/icon.svg`。OGP画像と同じく背景は単色で構成する
- **OGP画像**: `public/og-image.png`（1200×630）。元データは `docs/og-image.svg`。
  **背景を単色で構成している。** グラデーションを入れるとPNGの圧縮が効かず
  624KB になった。単色化で94KBに収まる（見た目はほぼ同じ）。
  ファイル名にハッシュが付かないため、キャッシュは1日に抑えている（`public/_headers`）。
- **個人情報**: 取得しない。Cookieも使わない。localStorageは端末内に留まり送信されない。
  → プライバシーポリシーは「情報を収集しない」旨の短い記載で足りる。
- **バックアップ**: 状態がGitリポジトリのみ。別途バックアップ不要。
- **依存関係の脆弱性**: `npm audit` を0件に保つ。本アプリはサーバを持たないため実行時攻撃面はないが、
  ビルド・テスト経路の汚染を防ぐため開発依存も対象とする。
  upstream に修正版がない場合は `package.json` の `overrides` でパッチ版へ固定し、
  理由と解除条件を README に記録する（現在: `minimatch` → GHSA-g3hv-75wg-m249）。

  > **2026-11-18 時点で 0 件を維持できていない。**
  > `picomatch` の ReDoS（GHSA-fc5q-39xc-vjpf, CVSS 7.5）は**全バージョンが対象**で
  > パッチが存在しない。`vite` と `vitest` 自身の依存であり、どの構成でも避けられない。
  > npm が示す「修正」は vitest を 3.1.4 へ戻すことだが、それでは以前解消した
  > critical が復活するため採らない。
  >
  > 影響は限定的である。ビルド時のグロブ照合でのみ使われ、照合パターンは
  > 自前の設定ファイルから来る。攻撃者が与える入力ではない。
  > upstream に修正版が出たら速やかに追随する。

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
