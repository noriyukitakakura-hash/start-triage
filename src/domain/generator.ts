import { JP_FDMA } from './profiles';
import { NON_WALKABLE_ILLUSTRATIONS, WALKABLE_ILLUSTRATIONS } from './illustrations';
import type { Rng } from './rng';
import type { Category, DecidingStep, RuleProfile, TriageCase } from './types';

/**
 * 症例ジェネレータ（SPEC §3.3）。
 *
 * **方式: 目標区分と確定ステップを先に決め、そこへ至る値域から逆算生成する。**
 * ランダムに値を振ってから判定する方式は区分の出現比率が偏るため採用しない。
 *
 * 確定ステップより後の項目も矛盾のない値を生成して提示する。
 * 「判定に不要な情報を無視できる」こと自体が訓練になるため。
 */

/** 目標区分と確定ステップの組み合わせ。これ以外は生成できない */
export interface Combination {
  target: Category;
  decidingStep: DecidingStep;
}

export const VALID_COMBINATIONS: readonly Combination[] = [
  { target: 'III', decidingStep: 'walk' },
  { target: 'I', decidingStep: 'airway' },
  { target: '0', decidingStep: 'airway' },
  { target: 'I', decidingStep: 'respiratoryRate' },
  { target: 'I', decidingStep: 'circulation' },
  { target: 'I', decidingStep: 'consciousness' },
  { target: 'II', decidingStep: 'consciousness' },
];

export function decidingStepsFor(target: Category): DecidingStep[] {
  return VALID_COMBINATIONS.filter((c) => c.target === target).map((c) => c.decidingStep);
}

export class ImpossibleCombinationError extends Error {
  constructor(target: Category, decidingStep: DecidingStep) {
    super(`区分 ${target} は ${decidingStep} ステップでは確定し得ない`);
    this.name = 'ImpossibleCombinationError';
  }
}

export interface GenerateOptions {
  target: Category;
  /** 省略時は target に対して有効なステップから抽選する */
  decidingStep?: DecidingStep;
  /** 境界値を出す確率 0..1（既定 0.35。SPEC §3.3） */
  boundaryRate?: number;
  profile?: RuleProfile;
  id?: string;
}

export interface GeneratedCase {
  case: TriageCase;
  target: Category;
  decidingStep: DecidingStep;
  /** 確定ステップの値が境界値だったか。10問構成の境界値数を数えるために使う */
  usedBoundary: boolean;
}

export const DEFAULT_BOUNDARY_RATE = 0.35;

/** 自発呼吸がある症例で生成しうる最小の呼吸数。0 は「呼吸なし」と矛盾するため使わない */
const MIN_BREATHING_RR = 4;
/** 呼吸数の上限域の幅 */
const RR_HIGH_SPAN = 14;
const CRT_MIN = 1.0;
const CRT_MAX = 4.0;
const CRT_STEP = 0.1;

interface Circulation {
  radialPulsePalpable: boolean;
  pulseRate: number | null;
  crtSeconds: number;
}

/** 循環ステップを「通過」する値。CRT は閾値未満、脈拍は 120 未満（SPEC §3.3 整合性制約） */
function circulationPass(rng: Rng, profile: RuleProfile, boundary: boolean): Circulation {
  const crtSeconds = boundary
    ? Number((profile.crtThresholdSeconds - CRT_STEP).toFixed(1))
    : rng.decimal(CRT_MIN, Number((profile.crtThresholdSeconds - CRT_STEP).toFixed(1)), CRT_STEP);
  return { radialPulsePalpable: true, pulseRate: rng.int(60, 119), crtSeconds };
}

/** 循環ステップに「該当」する値。CRT遅延 と 橈骨動脈触知不能 の2系統から選ぶ */
function circulationFail(rng: Rng, profile: RuleProfile, boundary: boolean): Circulation {
  const viaRadial = profile.useRadialPulse && rng.chance(0.4);
  if (viaRadial && !boundary) {
    // 橈骨動脈が触知できない。触知できなければ脈拍は数えられない（SPEC §3.3 整合性制約）。
    // CRT は正常域にもし得る。「CRTは正常だが橈骨動脈が触知できない」症例は教育価値が高い
    return { radialPulsePalpable: false, pulseRate: null, crtSeconds: rng.decimal(CRT_MIN, CRT_MAX, CRT_STEP) };
  }
  const crtSeconds = boundary
    ? profile.crtThresholdSeconds
    : rng.decimal(profile.crtThresholdSeconds, CRT_MAX, CRT_STEP);
  // CRT遅延があるなら脈拍は速い側に寄せる（生理学的整合）
  return { radialPulsePalpable: true, pulseRate: rng.int(100, 140), crtSeconds };
}

/**
 * 循環が評価されない症例（より手前のステップで確定する）向け。
 * 判定に影響しないが、提示する値として矛盾がないようにする。
 */
function circulationFree(rng: Rng, profile: RuleProfile): Circulation {
  if (profile.useRadialPulse && rng.chance(0.25)) {
    return { radialPulsePalpable: false, pulseRate: null, crtSeconds: rng.decimal(1.5, CRT_MAX, CRT_STEP) };
  }
  const pulseRate = rng.int(50, 150);
  // 脈拍 120 以上なら CRT を 1.5 秒以上に寄せる（SPEC §3.3 整合性制約）
  const crtMin = pulseRate >= 120 ? 1.5 : CRT_MIN;
  return { radialPulsePalpable: true, pulseRate, crtSeconds: rng.decimal(crtMin, CRT_MAX, CRT_STEP) };
}

function rrPassRange(profile: RuleProfile): [number, number] {
  return [profile.respiratoryRateLowMax + 1, profile.respiratoryRateHighMin - 1];
}

/** 呼吸数ステップを「通過」する値 */
function rrPass(rng: Rng, profile: RuleProfile, boundary: boolean): number {
  const [min, max] = rrPassRange(profile);
  if (boundary) return rng.chance(0.5) ? min : max;
  return rng.int(min, max);
}

/** 呼吸数ステップに「該当」する値。下限域と上限域から選ぶ */
function rrFail(rng: Rng, profile: RuleProfile, boundary: boolean): number {
  const lowAvailable = profile.respiratoryRateLowMax >= MIN_BREATHING_RR;
  const useLow = lowAvailable && rng.chance(0.4);

  if (useLow) {
    return boundary ? profile.respiratoryRateLowMax : rng.int(MIN_BREATHING_RR, profile.respiratoryRateLowMax);
  }
  return boundary
    ? profile.respiratoryRateHighMin
    : rng.int(profile.respiratoryRateHighMin, profile.respiratoryRateHighMin + RR_HIGH_SPAN);
}

/**
 * 1症例を生成する。
 *
 * @throws {ImpossibleCombinationError} target と decidingStep の組み合わせが成立しない場合
 */
export function generateCase(options: GenerateOptions, rng: Rng): GeneratedCase {
  const profile = options.profile ?? JP_FDMA;
  const boundaryRate = options.boundaryRate ?? DEFAULT_BOUNDARY_RATE;
  const target = options.target;

  const decidingStep = options.decidingStep ?? rng.pick(decidingStepsFor(target));
  if (!VALID_COMBINATIONS.some((c) => c.target === target && c.decidingStep === decidingStep)) {
    throw new ImpossibleCombinationError(target, decidingStep);
  }

  const id = options.id ?? `case-${rng.int(0, 2_147_483_647).toString(36)}`;

  // --- 手順1: 歩行 ---
  if (decidingStep === 'walk') {
    const illustration = rng.pick(WALKABLE_ILLUSTRATIONS);
    // 歩行可能な症例は他のバイタルも軽症域で生成する（SPEC §3.3 整合性制約）
    return {
      case: {
        id,
        patient: { illustrationId: illustration.id, situationKey: illustration.situationKey },
        canWalk: true,
        hasSpontaneousBreathing: true,
        breathingAfterAirway: null,
        respiratoryRate: rng.int(12, 20),
        radialPulsePalpable: true,
        pulseRate: rng.int(70, 100),
        crtSeconds: rng.decimal(CRT_MIN, Number((profile.crtThresholdSeconds - CRT_STEP).toFixed(1)), CRT_STEP),
        obeysCommands: true,
      },
      target,
      decidingStep,
      usedBoundary: false,
    };
  }

  const illustration = rng.pick(NON_WALKABLE_ILLUSTRATIONS);
  const patient = { illustrationId: illustration.id, situationKey: illustration.situationKey };

  // --- 手順2: 自発呼吸と気道確保 ---
  if (decidingStep === 'airway') {
    const circulation = circulationFree(rng, profile);
    return {
      case: {
        id,
        patient,
        canWalk: false,
        hasSpontaneousBreathing: false,
        breathingAfterAirway: target === 'I',
        respiratoryRate: 0,
        ...circulation,
        obeysCommands: false,
      },
      target,
      decidingStep,
      usedBoundary: false,
    };
  }

  // --- 手順3: 呼吸数 ---
  if (decidingStep === 'respiratoryRate') {
    const boundary = rng.chance(boundaryRate);
    const circulation = circulationFree(rng, profile);
    return {
      case: {
        id,
        patient,
        canWalk: false,
        hasSpontaneousBreathing: true,
        breathingAfterAirway: null,
        respiratoryRate: rrFail(rng, profile, boundary),
        ...circulation,
        obeysCommands: rng.chance(0.5),
      },
      target,
      decidingStep,
      usedBoundary: boundary,
    };
  }

  // 呼吸数ステップは通過させる。通過側の値にも独立に境界値バイアスをかける
  // （RR 29 を通過させてから循環で確定する症例は難度が高く、教育価値がある）
  const respiratoryRate = rrPass(rng, profile, rng.chance(boundaryRate));

  // --- 手順4: 循環 ---
  if (decidingStep === 'circulation') {
    const boundary = rng.chance(boundaryRate);
    return {
      case: {
        id,
        patient,
        canWalk: false,
        hasSpontaneousBreathing: true,
        breathingAfterAirway: null,
        respiratoryRate,
        ...circulationFail(rng, profile, boundary),
        obeysCommands: rng.chance(0.5),
      },
      target,
      decidingStep,
      usedBoundary: boundary,
    };
  }

  // --- 手順5: 意識 ---
  const boundary = rng.chance(boundaryRate);
  return {
    case: {
      id,
      patient,
      canWalk: false,
      hasSpontaneousBreathing: true,
      breathingAfterAirway: null,
      respiratoryRate,
      ...circulationPass(rng, profile, boundary),
      obeysCommands: target === 'II',
    },
    target,
    decidingStep,
    usedBoundary: boundary,
  };
}

// ---------------------------------------------------------------------------
// 10問連続モードの出題セット（SPEC §2.4）
// ---------------------------------------------------------------------------

/** 10問の正解区分の固定構成。残り1問はランダム */
export const QUIZ_COMPOSITION: readonly Category[] = ['I', 'I', 'I', 'I', 'II', 'II', 'III', 'III', '0'];
export const QUIZ_LENGTH = 10;
/** 10問中、これ以上を境界値症例にする */
export const QUIZ_MIN_BOUNDARY = 4;

export interface QuizSetOptions {
  boundaryRate?: number;
  profile?: RuleProfile;
}

/**
 * 10問セットを生成する。
 *
 * 構成は I類4 / II類2 / III類2 / 0類1 / ランダム1 を固定し、順序をシャッフルする。
 * 境界値症例が {@link QUIZ_MIN_BOUNDARY} 問に達するまで、境界値を取り得る症例を再生成する。
 */
export function generateQuizSet(rng: Rng, options: QuizSetOptions = {}): GeneratedCase[] {
  const profile = options.profile ?? JP_FDMA;
  const boundaryRate = options.boundaryRate ?? DEFAULT_BOUNDARY_RATE;

  const targets = [...QUIZ_COMPOSITION, rng.pick(['I', 'II', 'III', '0'] as const)];

  const items = rng.shuffle(targets).map((target, index) =>
    generateCase({ target, boundaryRate, profile, id: `quiz-${index + 1}` }, rng),
  );

  // 境界値症例が不足していれば境界値に差し替える。**区分の構成比は維持する**（target は変えない）。
  //
  // III類は walk、0類は airway でしか確定せず、どちらも真偽値判定なので境界値を持ち得ない。
  // そのため境界値の下限を満たすには、I類・II類側で確定ステップを境界値可能なものへ
  // 差し替える必要がある（I類4問すべてが airway を引くと上限3問で下限に届かない）。
  let boundaryCount = items.filter((i) => i.usedBoundary).length;
  for (let i = 0; i < items.length && boundaryCount < QUIZ_MIN_BOUNDARY; i++) {
    const item = items[i];
    if (item === undefined || item.usedBoundary) continue;

    const capableSteps = boundaryCapableStepsFor(item.target);
    if (capableSteps.length === 0) continue; // III類・0類は対象外

    // 元の確定ステップが境界値を取れるならそれを維持し、取れないなら取れるものへ差し替える
    const decidingStep = canUseBoundary(item.decidingStep) ? item.decidingStep : rng.pick(capableSteps);

    items[i] = generateCase(
      { target: item.target, decidingStep, boundaryRate: 1, profile, id: item.case.id },
      rng,
    );
    boundaryCount++;
  }

  return items;
}

/** 境界値を取り得る確定ステップか（歩行・気道確保は真偽値判定なので境界値が存在しない） */
export function canUseBoundary(step: DecidingStep): boolean {
  return step === 'respiratoryRate' || step === 'circulation' || step === 'consciousness';
}

/** その区分で境界値を取り得る確定ステップ。III類・0類では空になる */
export function boundaryCapableStepsFor(target: Category): DecidingStep[] {
  return decidingStepsFor(target).filter(canUseBoundary);
}
