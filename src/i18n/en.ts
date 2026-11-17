import type { Messages } from './types';

/**
 * 英語リソース。`Messages` 型により `ja.ts` と同一のキー集合であることを強制される。
 * 用語は docs/I18N.md §8 の対訳表に従う。
 */
export const en: Messages = {
  'app.title': 'START Triage Trainer',
  'app.tagline': 'Drill primary triage for mass casualty incidents',

  'nav.home': 'Home',
  'nav.practice': 'Practice',
  'nav.challenge': '10-Case Challenge',
  'nav.reference': 'START Reference',
  'nav.settings': 'Settings',

  'locale.label': 'Language',
  'locale.ja': '日本語',
  'locale.en': 'English',

  'disclaimer.training':
    'This app is a training simulation. In a real incident, follow the protocol and instructions of your own organization.',
  'disclaimer.criteria':
    'Judgements use the START criteria standardized by the Japan Fire and Disaster Management Agency (respiratory rate ≤9 or ≥30 /min indicates Immediate). These thresholds differ from the original US START protocol (>30 /min only).',

  'category.I.roman': 'I',
  'category.I.short': 'Immediate',
  'category.I.name': 'Immediate (Category I)',
  'category.I.color': 'Red',
  'category.II.roman': 'II',
  'category.II.short': 'Delayed',
  'category.II.name': 'Delayed (Category II)',
  'category.II.color': 'Yellow',
  'category.III.roman': 'III',
  'category.III.short': 'Minor',
  'category.III.name': 'Minor (Category III)',
  'category.III.color': 'Green',
  'category.0.roman': '0',
  'category.0.short': 'Deceased',
  'category.0.name': 'Deceased (Category 0)',
  'category.0.color': 'Black',

  // --- 判定根拠 ---
  'rationale.canWalk': 'Able to walk unaided',
  'rationale.cannotWalk': 'Unable to walk',
  'rationale.noBreathing': 'No spontaneous breathing',
  'rationale.breathingResumed': 'Breathing resumed after opening the airway',
  'rationale.breathingNotResumed': 'Still no breathing after opening the airway',
  'rationale.hasBreathing': 'Spontaneous breathing present',
  'rationale.rrLow': 'Respiratory rate {rr} /min ({threshold} or below)',
  'rationale.rrHigh': 'Respiratory rate {rr} /min ({threshold} or above)',
  'rationale.rrNormal': 'Respiratory rate {rr} /min (within range: above {low}, below {high})',
  'rationale.radialPulseAbsent': 'Radial pulse not palpable',
  'rationale.crtDelayed': 'CRT {crt} sec ({threshold} sec or more)',
  'rationale.circulationOk': 'CRT {crt} sec (under {threshold} sec), radial pulse palpable',
  'rationale.doesNotObeyCommands': 'Does not follow simple commands',
  'rationale.obeysCommands': 'Follows simple commands',

  // --- 解説 ---
  'explain.conclusion': 'The category is determined at this point. No further assessment is needed.',
  'explain.stepPassed': 'Passed',
  'explain.stepDecided': 'Decided here',
  'explain.stepSkipped': 'Not needed',
  'explain.skippedNote': 'The category was already determined, so {count} assessment(s) were not needed.',
  'explain.noSkipped': 'Every assessment was carried out before deciding.',

  // --- 評価ステップ名 ---
  'step.walk': 'Walking',
  'step.airway': 'Breathing / airway',
  'step.respiratoryRate': 'Respiratory rate',
  'step.circulation': 'Circulation',
  'step.consciousness': 'Consciousness',

  // --- バイタル項目名と単位 ---
  'vital.respiratoryRate': 'Respiratory rate',
  'vital.respiratoryRate.unit': '/min',
  'vital.radialPulse': 'Radial pulse',
  'vital.radialPulse.palpable': 'Palpable',
  'vital.radialPulse.absent': 'Not palpable',
  'vital.pulseRate': 'Pulse rate',
  'vital.pulseRate.unit': '/min',
  'vital.pulseRate.uncountable': 'Not measurable',
  'vital.crt': 'CRT',
  'vital.crt.unit': 'sec',
  'vital.commands': 'Response to commands',
  'vital.commands.follows': 'Follows',
  'vital.commands.doesNotFollow': 'Does not follow',
  'vital.breathing': 'Spontaneous breathing',
  'vital.breathing.present': 'Present',
  'vital.breathing.absent': 'Absent',

  // --- 学習モード (S2) ---
  'learn.heading': 'Practice',
  'learn.selectCategory': 'Choose the triage category for this casualty',
  'learn.next': 'Next casualty',
  'learn.correct': 'Correct',
  'learn.incorrect': 'Incorrect',
  'learn.yourAnswer': 'Your answer',
  'learn.expectedAnswer': 'Correct category',
  'learn.sessionStats': 'This session: {correct} of {answered} correct ({accuracy}%)',
  'learn.totalStats': 'All time: {correct} of {answered} correct ({accuracy}%)',
  'learn.shortcutHint': 'Keyboard: 1 / 2 / 3 / 0 to answer, Enter for next',

  // --- 実測モード ---
  'observation.heading': 'Observe the breathing',
  'observation.instruction': 'Watch the chest and tap along with each breath.',
  'observation.countingOptional': 'You may also decide without counting.',
  'observation.tap': 'Count breaths',
  'observation.reset': 'Start over',
  'observation.elapsed': 'Elapsed',
  'observation.elapsedValue': '{seconds} sec',
  'observation.taps': 'Taps',
  'observation.tapsValue': '{count}',
  'observation.estimated': 'Estimate',
  'observation.estimatedValue': 'About {rate} /min',
  'observation.needMoreTaps': 'Keep counting to get an estimate',
  'observation.openAirway': 'Open the airway',
  'observation.airwayNotNeeded': 'Spontaneous breathing confirmed — no airway maneuver needed.',
  'observation.airwayResumed': 'Breathing resumed after opening the airway.',
  'observation.airwayNoBreathing': 'Still no breathing after opening the airway.',
  'observation.reducedMotionFallback': 'Reduced motion is enabled, so the respiratory rate is shown as a number.',

  // --- 解説の追加分 ---
  'explain.heading': 'Why this answer',
  'explain.countAccuracy': 'Your count {estimated} /min — actual {actual} /min (off by {delta})',
  'explain.countExact': 'Your count {estimated} /min matches the actual rate.',
  'explain.countNotAttempted': 'You did not count. The actual rate was {actual} /min.',
  'explain.classificationCorrect': 'Your count was off, but you still judged "{band}" correctly.',
  'explain.classificationWrong': 'The counting error changed your judgement of "{band}".',
  'explain.bandLow': '{threshold} or below',
  'explain.bandHigh': '{threshold} or above',
  'explain.bandNormal': 'above {low} and below {high}',
  'explain.agonalNote': 'This is agonal breathing. The chest is still moving, so spontaneous breathing is present, and a rate of {threshold} or below makes it Immediate.',

  // --- 設定 (S6) ---
  'settings.vitalsPresentation': 'Respiratory rate',
  'settings.vitalsPresentation.numeric': 'Number',
  'settings.vitalsPresentation.numeric.description': 'Shows the rate as a number. Trains the thresholds.',
  'settings.vitalsPresentation.observed': 'Observe',
  'settings.vitalsPresentation.observed.description': 'Watch the chest and count. Trains the field skill.',

  // --- シェル・設定シート (S6) ---
  'app.titleShort': 'START Triage',
  'settings.heading': 'Settings',
  'settings.open': 'Open settings',
  'settings.close': 'Close',
  'settings.disclaimer': 'Disclaimer and criteria',
  'settings.stats': 'All-time results',
  'disclaimer.heading': 'Please read before you start',
  'disclaimer.acknowledge': 'I understand',
  'feedback.heading': 'Result',
  'feedback.showExplanation': 'Show explanation',
  'flow.passed': 'Passed',
  'flow.decided': 'Decided',
  'flow.skipped': 'Not needed',

  // --- 書式 ---
  'format.durationWithMinutes': '{minutes}:{seconds}',
  'format.durationSeconds': '{seconds}s',

  // --- ホーム (S1) ---
  'home.learn.description': 'Work through cases one at a time with explanations. Unlimited.',
  'home.challenge.description': 'Answer 10 cases in a row against the clock.',
  'home.reference.description': 'Review the START flow and the category definitions.',
  'home.bestTime': 'Personal best',
  'home.bestTime.numeric': 'Number mode',
  'home.bestTime.observed': 'Observe mode',
  'home.noBestTime': 'No record yet',
  'common.back': 'Back',

  // --- 10問チャレンジ (S3) ---
  'challenge.heading': '10-Case Challenge',
  'challenge.ready': 'Ready',
  'challenge.start': 'Start',
  'challenge.progress': '{current} / {total}',
  'challenge.quit': 'Quit',

  // --- 結果 (S4) ---
  'result.heading': 'Result',
  'result.score': '{correct} of {total} correct',
  'result.time': 'Time',
  'result.perfect': 'Perfect score',
  'result.newBest': 'New personal best',
  'result.bestSoFar': 'Personal best {time}',
  'result.retry': 'Try again',
  'result.backHome': 'Home',
  'result.share': 'Post on X',
  'result.shareHint': 'Available with a perfect score in observe mode',
  'result.suddenDeathEnded': 'Ended early on a wrong answer',
  'result.reviewHint': 'Tap a case to see its explanation',
  'result.mode.numeric': 'Number mode record',
  'result.mode.observed': 'Observe mode record',
  'result.modeNote': 'Times are recorded separately per respiratory-rate mode. Observe mode takes longer by design, so the two cannot be compared.',

  // --- リファレンス (S5) ---
  'reference.heading': 'START Reference',
  'reference.flow': 'Decision flow',
  'reference.categories': 'Triage categories',
  'reference.criteria': 'Criteria in use',
  'reference.criteria.rr': 'Respiratory rate {low} or below, or {high} or above → Immediate',
  'reference.criteria.circulation': 'CRT {crt} sec or more, or radial pulse not palpable → Immediate',
  'reference.criteria.consciousness': 'Does not follow simple commands → Immediate',
  'reference.flowStep.walk': 'Can they walk? If yes → Minor',
  'reference.flowStep.airway': 'Spontaneous breathing? If not, open the airway → resumes: Immediate, does not: Deceased',
  'reference.flowStep.respiratoryRate': 'Is the respiratory rate within range? If not → Immediate',
  'reference.flowStep.circulation': 'Is circulation adequate? If not → Immediate',
  'reference.flowStep.consciousness': 'Do they follow simple commands? If not → Immediate, if yes → Delayed',

  // --- 設定の追加分 ---
  'settings.suddenDeath': 'Sudden death',
  'settings.suddenDeath.description': 'End the challenge immediately on the first wrong answer.',
  'settings.boundaryRate': 'Borderline case rate',
  'settings.boundaryRate.description': 'How often values land exactly on a threshold. Higher is harder.',
  'settings.showTimer': 'Show the timer',
  'settings.showTimer.description': 'Display elapsed time during the challenge.',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.resetStats': 'Clear all-time results',
  'settings.resetStats.done': 'Cleared',

  // --- X への投稿 ---
  'share.text': 'Perfect score on the START triage drill — 10/10\nTime {time} ({mode})',
  'share.textWithBest': 'Perfect score on the START triage drill — 10/10\nTime {time} ({mode})\nNew personal best 🎉',
  'share.mode.numeric': 'number mode',
  'share.mode.observed': 'observe mode',
  'share.hashtags': 'STARTtriage,DisasterMedicine,MassCasualty',

  // --- CRT の実測 ---
  'crt.heading': 'Capillary refill time',
  'crt.instruction': 'Press the nail for {seconds} seconds, release, and time how long the colour takes to return.',
  'crt.press': 'Press the nail',
  'crt.pressing': 'Keep pressing — {seconds}s left',
  'crt.tooShort': 'Hold for {seconds} seconds. Without enough pressure the measurement is not valid.',
  'crt.watching': 'Tap when the colour has returned',
  'crt.reportReturned': 'Colour has returned',
  'crt.measured': 'Measured {seconds} sec',
  'crt.retry': 'Measure again',
  'crt.notMeasured': 'Not measured',

  // --- 脈拍の実測 ---
  'pulse.heading': 'Radial pulse',
  'pulse.instruction': 'Feel the radial pulse at the wrist and tap along with each beat.',
  'pulse.tap': 'Count beats',
  'pulse.notPalpable': 'No pulse felt',
  'pulse.palpable': 'Pulse felt',
  'pulse.measured': '{rate} /min',
  'pulse.notMeasured': 'Not measured',
  'pulse.measure': 'Palpate',

  // --- アナログ時計 ---
  'clock.elapsed': 'Elapsed time',

  // --- 解説の追加分 ---
  'explain.crtAccuracy': 'CRT measured {measured}s — actual {actual}s (off by {delta})',
  'explain.crtExact': 'CRT measured {measured}s, matching the actual value.',
  'explain.crtNotMeasured': 'You did not measure CRT. The actual value was {actual}s.',
  'explain.crtBandCorrect': 'Your measurement was off, but you still judged "{band}" correctly.',
  'explain.crtBandWrong': 'The measurement error changed your judgement of "{band}".',
  'explain.crtBandDelayed': '{threshold} sec or more',
  'explain.crtBandWithinRange': 'under {threshold} sec',

  // --- 狭い計測器セル用の短い文言 ---
  'observation.instructionShort': 'Watch the chest\nand tap',
  'crt.remaining': '{seconds}s left',
  'crt.tooShortShort': 'Hold {seconds}s',
  'crt.watchingShort': 'Tap when back',
  'pulse.tapShort': 'Count beats',
  'pulse.absentShort': 'None felt',
  'vital.commandsShort': 'Commands',

  'crt.pressHint': 'Press & hold',

  // --- イラスト（答えを漏らさない中立な文言にとどめる。SPEC §5.3） ---
  'patient.figureLabel': 'Illustration of a casualty',

  // --- 状況文 ---
  'situation.walkedOnOwn': 'Walked over unaided when called',
  'situation.limpedOver': 'Limped over unaided',
  'situation.walkedHoldingArm': 'Walked over unaided, holding one arm',
  'situation.stoodAndWaved': 'Stood up and waved in response',
  'situation.walkedSlowlyOnOwn': 'Walked out slowly but unaided',
  'situation.sittingUnableToStand': 'Sitting on the ground, unable to stand',
  'situation.lyingStill': 'Lying on their back, not moving',
  'situation.lyingFaceDown': 'Lying face down, not moving',
  'situation.legsPinnedByDebris': 'Legs pinned under debris, unable to move',
  'situation.leaningUnableToMove': 'Leaning against a wall, unable to move',
  'situation.trappedInVehicle': 'Trapped inside a vehicle, unable to move',
  'situation.sittingAgainstDebris': 'Sitting propped against debris',
  'situation.standingButCannotWalk': 'Standing, but their legs will not move and they cannot walk',

  'dev.scaffoldReady': 'P0 scaffold is ready. Current language: {locale}',
};
