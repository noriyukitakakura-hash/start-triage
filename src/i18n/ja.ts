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

  // --- 判定根拠（domain/judge.ts が返すキー。docs/I18N.md §5） ---
  'rationale.canWalk': '自力で歩行できる',
  'rationale.cannotWalk': '歩行不能',
  'rationale.noBreathing': '自発呼吸なし',
  'rationale.breathingResumed': '気道確保により呼吸が再開した',
  'rationale.breathingNotResumed': '気道確保後も自発呼吸なし',
  'rationale.hasBreathing': '自発呼吸あり',
  'rationale.rrLow': '呼吸数 {rr}回/分（{threshold}回以下）',
  'rationale.rrHigh': '呼吸数 {rr}回/分（{threshold}回以上）',
  'rationale.rrNormal': '呼吸数 {rr}回/分（{low}回超〜{high}回未満で基準内）',
  'rationale.radialPulseAbsent': '橈骨動脈を触知できない',
  'rationale.crtDelayed': 'CRT {crt}秒（{threshold}秒以上）',
  'rationale.circulationOk': 'CRT {crt}秒（{threshold}秒未満）、橈骨動脈は触知可',
  'rationale.doesNotObeyCommands': '簡単な指示に従えない',
  'rationale.obeysCommands': '簡単な指示に従える',

  // --- 解説 ---
  'explain.conclusion': 'この時点で判定が確定します。以降の評価は不要です。',
  'explain.stepPassed': '通過',
  'explain.stepDecided': 'ここで確定',
  'explain.stepSkipped': '評価不要',
  'explain.skippedNote': '手前で判定が確定したため、{count}項目の評価は不要でした。',
  'explain.noSkipped': 'すべての項目を評価して判定しました。',

  // --- 評価ステップ名（フローチャートと解説で共用） ---
  'step.walk': '歩行',
  'step.airway': '呼吸・気道確保',
  'step.respiratoryRate': '呼吸数',
  'step.circulation': '循環',
  'step.consciousness': '意識',

  // --- バイタル項目名と単位 ---
  'vital.respiratoryRate': '呼吸数',
  'vital.respiratoryRate.unit': '回/分',
  'vital.radialPulse': '橈骨動脈',
  'vital.radialPulse.palpable': '触知可',
  'vital.radialPulse.absent': '触知不能',
  'vital.pulseRate': '脈拍',
  'vital.pulseRate.unit': '回/分',
  'vital.pulseRate.uncountable': '測定不能',
  'vital.crt': 'CRT',
  'vital.crt.unit': '秒',
  'vital.commands': '指示応答',
  'vital.commands.follows': '従える',
  'vital.commands.doesNotFollow': '従えない',
  'vital.breathing': '自発呼吸',
  'vital.breathing.present': 'あり',
  'vital.breathing.absent': 'なし',

  // --- 状況文（domain/illustrations.ts のキー。SPEC §3.4） ---
  'situation.walkedOnOwn': '呼びかけに応じて自力で歩いてきた',
  'situation.limpedOver': '足を引きずりながら自力で歩いてきた',
  'situation.walkedHoldingArm': '腕を押さえながら自力で歩いてきた',
  'situation.stoodAndWaved': '自分で立ち上がり、手を挙げて応答した',
  'situation.walkedSlowlyOnOwn': 'ゆっくりだが自力で歩いて避難してきた',
  'situation.sittingUnableToStand': '座り込んでおり、立ち上がれない',
  'situation.lyingStill': '仰向けに倒れて動かない',
  'situation.lyingFaceDown': 'うつ伏せに倒れて動かない',
  'situation.legsPinnedByDebris': '瓦礫に下肢を挟まれて動けない',
  'situation.leaningUnableToMove': '壁にもたれたまま動けない',
  'situation.trappedInVehicle': '車内に閉じ込められて動けない',
  'situation.sittingAgainstDebris': '瓦礫に寄りかかって座り込んでいる',
  'situation.standingButCannotWalk': '立っているが、足が動かず歩けない',

  'dev.scaffoldReady': 'P0 雛形構築が完了しました。現在の言語: {locale}',
} as const;
