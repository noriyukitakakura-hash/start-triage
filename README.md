# START法トリアージ・トレーナー / START Triage Trainer

災害現場の一次トリアージ（START法）を反復練習するWebアプリ。

- 本番: https://start.keiku-labo.space
- 対応言語: 日本語 / English（UIから随時切替）

> **本アプリは教育・訓練目的のシミュレーションです。**
> 実際の傷病者対応は所属機関のプロトコル・指示に従ってください。
> 判定基準は日本の消防庁標準のSTART法（呼吸数 9回以下 または 30回以上 で I類）に基づき、
> 米国版START原典の基準（30回超のみ）とは異なります。

---

## ドキュメント

| 文書 | 内容 |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | 企画・システム仕様（判定ロジック、症例ジェネレータ、画面、開発計画） |
| [`docs/INFRA.md`](docs/INFRA.md) | サーバ構成（Cloudflare Pages、月額¥0の根拠、配信設定） |
| [`docs/I18N.md`](docs/I18N.md) | 多言語対応（ja/en、対訳表、**言語と判定基準を独立させる原則**） |

## 開発

```sh
npm ci
npm run dev        # 開発サーバ
npm run test       # Vitest
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # typecheck + 本番ビルド → dist/
```

Node は `.node-version`（22）に固定。CI・Cloudflare Pages も同バージョンを使う。

## アーキテクチャ上の制約

実装時に必ず守る規約。いずれもリントまたはテストで機械的に担保している。

1. **`src/domain/` は React・i18n に依存しない。** 純関数のみで、表示文字列を一切持たない。
   判定根拠は `RationaleItem[]`（翻訳キー＋パラメータ）として返し、文章化は表示層が行う。
   → `eslint.config.js` の `no-restricted-imports` と `tests/i18n.spec.ts` §9-4 で検査。
2. **言語切替は判定基準（`RuleProfile`）を変更しない。** `locale` と `profile` は独立した状態。
   → `tests/localeSwitch.spec.tsx` で検査。理由は `docs/I18N.md` §2。
3. **`ja.ts` のキー集合が正。** `en.ts` は `Messages` 型で同一キー集合を強制される。
   → キー・プレースホルダ・空文字を `tests/i18n.spec.ts` で検査。
4. **外部リソースをロードしない。** CDN・Webフォント・解析タグ・外部画像を使わない。
   これにより `public/_headers` の `default-src 'self'` が成立し、オフライン動作も保証される。

## 依存関係のメモ

- `package.json` の `overrides.minimatch` は GHSA-g3hv-75wg-m249（glob DoS）回避のためのもの。
  `typescript-eslint` が依存する `minimatch` をパッチ版へ固定している。
  upstream が追従したら削除してよい。

## デプロイ

`main` への push で Cloudflare Pages が自動ビルド・デプロイする。
テストの gate は GitHub Actions（`.github/workflows/ci.yml`）が担い、
`main` へのマージ必須チェックに設定する。詳細は [`docs/INFRA.md`](docs/INFRA.md) §2。

## ライセンス

未定（公開前に決定する）。
