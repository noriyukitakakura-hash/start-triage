# START法トリアージ・トレーナー / START Triage Trainer

災害現場の一次トリアージ（START法）を反復練習するWebアプリ。

- 本番: https://start.keiku-labo.space （予備: https://triage-start.pages.dev）
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
| [`docs/OBSERVATION.md`](docs/OBSERVATION.md) | 呼吸数の実測モード（胸郭アニメーション、観察時間と分解能、判別マージン±4の根拠） |

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
5. **呼吸アニメーションは厳密に毎分 `respiratoryRate` 回でなければならない。**
   利用者のタップ数が真値とずれると誤った数値を教えることになる。CSS の `animation-duration`
   で駆動し、`周期 × 呼吸数 === 60` をテストで保証している。
   → `tests/breathing.spec.ts`、理由は `docs/OBSERVATION.md` §3.2。
6. **実測モードでは気道確保ボタンを全症例に表示する。**
   自発呼吸なしの症例だけに出すと、ボタンの有無が観察前に答えを漏らす。
   → `docs/OBSERVATION.md` §3.1。
7. **実測モードのタイムは数値モードと比較しない。** 自己ベストは提示方式ごとに分離して記録する。
   → `docs/OBSERVATION.md` §3.6。

## 依存関係のメモ

- `package.json` の `overrides.minimatch` は GHSA-g3hv-75wg-m249（glob DoS）回避のためのもの。
  `typescript-eslint` が依存する `minimatch` をパッチ版へ固定している。
  upstream が追従したら削除してよい。

## 変更の進め方

`main` は保護されており、**直接 push できない**（管理者も含む）。

```sh
git switch -c <branch>
# 変更してコミット
git push -u origin <branch>
gh pr create --fill
# verify が通ったらマージ
gh pr merge --squash --delete-branch
```

必須チェックは `verify` のみ。`deploy` は main への push でしか走らないため、
必須にすると PR が永久にマージできなくなる。詳細は [`docs/INFRA.md`](docs/INFRA.md) §2.1。

## デプロイ

`main` への push で GitHub Actions が検証し、通過したものだけを配信する
（`.github/workflows/ci.yml`）。`verify` が落ちれば `deploy` は走らない。
**検証した `dist` をそのまま配信する**ため、配信側では再ビルドしない。

手元から配信する場合は `npm run deploy`。
必要な Secrets と、Cloudflare の Git 連携を使わない理由は
[`docs/INFRA.md`](docs/INFRA.md) §2 を参照。

## ライセンス

未定（公開前に決定する）。
