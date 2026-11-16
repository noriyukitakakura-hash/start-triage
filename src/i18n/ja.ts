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

  // --- 学習モード (S2) ---
  'learn.heading': '学習モード',
  'learn.selectCategory': 'この傷病者のトリアージ区分を選んでください',
  'learn.next': '次の症例',
  'learn.correct': '正解',
  'learn.incorrect': '不正解',
  'learn.yourAnswer': 'あなたの回答',
  'learn.expectedAnswer': '正しい区分',
  'learn.sessionStats': 'このセッション: {answered}問中 {correct}問正解（{accuracy}%）',
  'learn.totalStats': '累計: {answered}問中 {correct}問正解（{accuracy}%）',
  'learn.shortcutHint': 'キーボード: 1 / 2 / 3 / 0 で回答、Enter で次へ',

  // --- 実測モード (docs/OBSERVATION.md §6) ---
  'observation.heading': '呼吸の観察',
  'observation.instruction': '胸郭の動きを見て、呼吸に合わせてタップしてください。',
  'observation.countingOptional': '数えずに判断してもかまいません。',
  'observation.tap': '呼吸を数える',
  'observation.reset': '数え直す',
  'observation.elapsed': '経過',
  'observation.elapsedValue': '{seconds} 秒',
  'observation.taps': 'タップ',
  'observation.tapsValue': '{count} 回',
  'observation.estimated': '推定',
  'observation.estimatedValue': '約 {rate} 回/分',
  'observation.needMoreTaps': 'もう少し数えると推定値が出ます',
  'observation.openAirway': '気道確保を行う',
  'observation.airwayNotNeeded': '自発呼吸を確認。気道確保は不要です。',
  'observation.airwayResumed': '気道確保により呼吸が再開しました。',
  'observation.airwayNoBreathing': '気道確保後も自発呼吸がありません。',
  'observation.reducedMotionFallback': '動きを減らす設定が有効なため、呼吸数を数値で表示しています。',

  // --- 解説の追加分 ---
  'explain.heading': '判定の根拠',
  'explain.countAccuracy': '推定 {estimated} 回/分 ／ 実際 {actual} 回/分（誤差 {delta}）',
  'explain.countExact': '推定 {estimated} 回/分。実際の呼吸数と一致しています。',
  'explain.countNotAttempted': '呼吸数は数えませんでした。実際は {actual} 回/分です。',
  'explain.classificationCorrect': '数え値はずれましたが、「{band}」という判断自体は正しくできています。',
  'explain.classificationWrong': '数え値のずれが「{band}」の判断に影響しています。',
  'explain.bandLow': '{threshold}回以下',
  'explain.bandHigh': '{threshold}回以上',
  'explain.bandNormal': '{low}回超〜{high}回未満',
  'explain.agonalNote': '死戦期呼吸です。胸郭はわずかに動いているため自発呼吸はあり、呼吸数が{threshold}回以下なので I類になります。',

  // --- 設定 (S6) ---
  'settings.vitalsPresentation': '呼吸数の提示',
  'settings.vitalsPresentation.numeric': '数値',
  'settings.vitalsPresentation.numeric.description': '呼吸数を数値で表示します。閾値の記憶を訓練します。',
  'settings.vitalsPresentation.observed': '実測',
  'settings.vitalsPresentation.observed.description': '胸郭の動きを見て数えます。現場の実務を訓練します。',

  // --- シェル・設定シート (S6) ---
  'app.titleShort': 'START法トリアージ',
  'settings.heading': '設定',
  'settings.open': '設定を開く',
  'settings.close': '閉じる',
  'settings.disclaimer': '免責・判定基準について',
  'settings.stats': '累計成績',
  'disclaimer.heading': 'ご確認ください',
  'disclaimer.acknowledge': '確認しました',
  'feedback.heading': '判定結果',
  'feedback.showExplanation': '解説を見る',
  'flow.passed': '通過',
  'flow.decided': '確定',
  'flow.skipped': '不要',

  // --- 書式 ---
  'format.durationWithMinutes': '{minutes}分{seconds}秒',
  'format.durationSeconds': '{seconds}秒',

  // --- ホーム (S1) ---
  'home.learn.description': '1問ずつ解説を見ながら練習します。回数無制限。',
  'home.challenge.description': '10問を連続で解き、所要時間を計測します。',
  'home.reference.description': 'START法の判定フローと区分の定義を確認します。',
  'home.bestTime': '自己ベスト',
  'home.bestTime.numeric': '数値モード',
  'home.bestTime.observed': '実測モード',
  'home.noBestTime': '記録なし',
  'common.back': '戻る',

  // --- 10問チャレンジ (S3) ---
  'challenge.heading': '10問チャレンジ',
  'challenge.ready': '準備',
  'challenge.start': '開始',
  'challenge.progress': '{current} / {total}',
  'challenge.quit': '中断',

  // --- 結果 (S4) ---
  'result.heading': '結果',
  'result.score': '{total}問中 {correct}問正解',
  'result.time': 'タイム',
  'result.perfect': '全問正解',
  'result.newBest': '自己ベスト更新',
  'result.bestSoFar': '自己ベスト {time}',
  'result.retry': 'もう一度',
  'result.backHome': 'ホームへ',
  'result.share': 'Xに投稿する',
  'result.shareHint': '実測モードで全問正解すると投稿できます',
  'result.suddenDeathEnded': '誤答のため中断しました',
  'result.reviewHint': '各問をタップすると解説を見られます',
  'result.mode.numeric': '数値モードの記録',
  'result.mode.observed': '実測モードの記録',
  'result.modeNote': 'タイムは呼吸数の提示方式ごとに記録されます。観察に時間がかかる実測モードと数値モードは比較できません。',

  // --- リファレンス (S5) ---
  'reference.heading': 'START法リファレンス',
  'reference.flow': '判定フロー',
  'reference.categories': 'トリアージ区分',
  'reference.criteria': '採用している基準値',
  'reference.criteria.rr': '呼吸数 {low}回以下 または {high}回以上 で I類',
  'reference.criteria.circulation': 'CRT {crt}秒以上 または 橈骨動脈 触知不能 で I類',
  'reference.criteria.consciousness': '簡単な指示に従えなければ I類',
  'reference.flowStep.walk': '歩行可能か？ → 可能なら III類',
  'reference.flowStep.airway': '自発呼吸はあるか？ なければ気道確保 → 再開で I類、再開しなければ 0類',
  'reference.flowStep.respiratoryRate': '呼吸数は基準内か？ 外れていれば I類',
  'reference.flowStep.circulation': '循環は保たれているか？ 保たれていなければ I類',
  'reference.flowStep.consciousness': '簡単な指示に従えるか？ 従えなければ I類、従えれば II類',

  // --- 設定の追加分 ---
  'settings.suddenDeath': 'サドンデス',
  'settings.suddenDeath.description': '10問チャレンジで1問でも誤答したら即終了します。',
  'settings.boundaryRate': '境界値の出題率',
  'settings.boundaryRate.description': '閾値ちょうどの値を出す割合です。高いほど難しくなります。',
  'settings.showTimer': '経過時間を表示',
  'settings.showTimer.description': '10問チャレンジ中にタイマーを表示します。',
  'settings.on': 'する',
  'settings.off': 'しない',
  'settings.resetStats': '累計成績を消去',
  'settings.resetStats.done': '消去しました',

  // --- X への投稿 (SPEC §2.5) ---
  'share.text': 'START法トリアージ 10問チャレンジ 全問正解！\nタイム {time}（{mode}）',
  'share.textWithBest': 'START法トリアージ 10問チャレンジ 全問正解！\nタイム {time}（{mode}）\n自己ベスト更新 🎉',
  'share.mode.numeric': '数値モード',
  'share.mode.observed': '実測モード',
  'share.hashtags': 'STARTトリアージ,災害医療,トリアージ訓練',

  // --- CRT の実測 (docs/OBSERVATION.md) ---
  'crt.heading': 'CRT（毛細血管再充満時間）の測定',
  'crt.instruction': '爪を{seconds}秒間押し続けてから離し、色が戻るまでの時間を測ります。',
  'crt.press': '爪を押す',
  'crt.pressing': '押し続けてください 残り {seconds} 秒',
  'crt.tooShort': '{seconds}秒間押し続けてください。圧迫が足りないと正しく測れません。',
  'crt.watching': '色が戻ったら押してください',
  'crt.reportReturned': '色が戻った',
  'crt.measured': '測定値 {seconds} 秒',
  'crt.retry': '測り直す',
  'crt.notMeasured': '未測定',

  // --- 脈拍の実測 ---
  'pulse.heading': '橈骨動脈の触知',
  'pulse.instruction': '手首の橈骨動脈に触れ、拍動に合わせてタップしてください。',
  'pulse.tap': '脈を数える',
  'pulse.notPalpable': '拍動を触れません',
  'pulse.palpable': '拍動を触れます',
  'pulse.measured': '{rate} 回/分',
  'pulse.notMeasured': '未測定',
  'pulse.measure': '触知する',

  // --- アナログ時計 ---
  'clock.elapsed': '経過時間',

  // --- 解説の追加分 ---
  'explain.crtAccuracy': 'CRT 測定 {measured}秒 ／ 実際 {actual}秒（誤差 {delta}）',
  'explain.crtExact': 'CRT 測定 {measured}秒。実際の値と一致しています。',
  'explain.crtNotMeasured': 'CRTは測定しませんでした。実際は {actual}秒です。',
  'explain.crtBandCorrect': '測定値はずれましたが、「{band}」という判断自体は正しくできています。',
  'explain.crtBandWrong': '測定値のずれが「{band}」の判断に影響しています。',
  'explain.crtBandDelayed': '{threshold}秒以上',
  'explain.crtBandWithinRange': '{threshold}秒未満',

  // --- イラスト（答えを漏らさない中立な文言にとどめる。SPEC §5.3） ---
  'patient.figureLabel': '傷病者のイラスト',

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
