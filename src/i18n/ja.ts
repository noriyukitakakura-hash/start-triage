/**
 * 日本語リソース。**このファイルのキー集合が正** であり、`en.ts` は型で同一性を強制される。
 * 詳細は docs/I18N.md §3
 */
export const ja = {
  'app.title': 'START法トリアージ・トレーナー',
  'app.tagline': '災害現場の一次トリアージを反復練習する',

  'nav.home': 'ホーム',
  'nav.practice': '学習モード',
  'nav.challenge': '10問チャレンジ',
  'nav.reference': 'START法リファレンス',
  'nav.settings': '設定',

  'locale.label': '言語',
  'locale.ja': '日本語',
  'locale.en': 'English',

  // docs/I18N.md §2: 英語UIでも採用基準が JP-FDMA であることを常時明示する
  'disclaimer.training': '本アプリは教育・訓練目的のシミュレーションです。実際の傷病者対応は所属機関のプロトコル・指示に従ってください。',
  'disclaimer.criteria': '判定基準は日本の消防庁標準のSTART法（呼吸数 9回以下 または 30回以上 で I類）に基づきます。米国版START原典の基準（30回超のみ）とは異なります。',

  'category.I.roman': 'I',
  'category.I.short': '緊急',
  'category.I.name': 'I類・緊急治療群',
  'category.I.color': '赤',
  'category.II.roman': 'II',
  'category.II.short': '非緊急',
  'category.II.name': 'II類・非緊急治療群',
  'category.II.color': '黄',
  'category.III.roman': 'III',
  'category.III.short': '軽処置',
  'category.III.name': 'III類・軽処置群',
  'category.III.color': '緑',
  'category.0.roman': '0',
  'category.0.short': '死亡',
  'category.0.name': '0類・死亡群',
  'category.0.color': '黒',

  'dev.scaffoldReady': 'P0 雛形構築が完了しました。現在の言語: {locale}',
} as const;
