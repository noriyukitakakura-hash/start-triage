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
