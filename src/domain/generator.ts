import { JP_FDMA } from './profiles';
import { NON_WALKABLE_ILLUSTRATIONS, WALKABLE_ILLUSTRATIONS, type Illustration } from './illustrations';
import type { Rng } from './rng';
import { NON_OBEYING_RESPONSES, type Category, type DecidingStep, type NonObeyingResponse, type RuleProfile, type TriageCase } from './types';

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
  /**
   * 呼吸数を判定閾値からこの回数以上離す（既定 0 = 制約なし）。
   *
   * 実測モード（胸郭アニメーションを数える）で使う。観察して数える方式では
   * 分解能が観察時間に縛られ、±1 の真の境界値を判別できないため、
   * 判別可能なマージンを確保する必要がある。詳細は docs/OBSERVATION.md
   */
  rrMargin?: number;
  /**
   * CRT を判定閾値からこの秒数以上離す（既定 0 = 制約なし）。
   *
   * 実測モード（爪床を圧迫して色が戻るのを測る）で使う。
   * 目視の計測誤差はおよそ ±0.3 秒あり、1.9 秒と 2.0 秒は区別できない。
   */
  crtMargin?: number;
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
/** 呼吸数の絶対上限。マージンを足しても超えない */
const RR_ABS_MAX = 44;

/**
 * 従命できない症例の反応を選ぶ。
 *
 * **自発呼吸が無い症例は声を出せない。** 呼吸が無いのにうめき声を上げるのは
 * 生理学的に矛盾するため、`voiceOnly` を候補から外す。
 */
function pickNonObeyingResponse(rng: Rng, hasSpontaneousBreathing: boolean): NonObeyingResponse {
  const candidates = hasSpontaneousBreathing
    ? NON_OBEYING_RESPONSES
    : NON_OBEYING_RESPONSES.filter((r) => r !== 'voiceOnly');
  return rng.pick(candidates);
}
/** 歩行可能な症例（III類）の軽症域。通過域との交差を取って使う */
const RR_MILD_RANGE: readonly [number, number] = [12, 20];
const CRT_MIN = 1.0;
const CRT_MAX = 4.0;
const CRT_STEP = 0.1;

interface Circulation {
  radialPulsePalpable: boolean;
  pulseRate: number | null;
  crtSeconds: number;
}

/** 循環ステップを「通過」する値。CRT は閾値未満、脈拍は 120 未満（SPEC §3.3 整合性制約） */
function circulationPass(
  rng: Rng,
  profile: RuleProfile,
  boundary: boolean,
  margin: number,
): Circulation {
  const max = Number((profile.crtThresholdSeconds - (margin > 0 ? margin : CRT_STEP)).toFixed(1));
  if (max < CRT_MIN) {
    throw new RangeError(`crtMargin ${margin} が大きすぎる: CRT の通過域が空になる`);
  }
  // margin > 0 のときは閾値から離す制約が優先されるため、境界値を取らない
  const crtSeconds = boundary && margin === 0 ? max : rng.decimal(CRT_MIN, max, CRT_STEP);
  return { radialPulsePalpable: true, pulseRate: rng.int(60, 119), crtSeconds };
}

/** 循環ステップに「該当」する値。CRT遅延 と 橈骨動脈触知不能 の2系統から選ぶ */
function circulationFail(
  rng: Rng,
  profile: RuleProfile,
  boundary: boolean,
  margin: number,
): Circulation {
  const viaRadial = profile.useRadialPulse && rng.chance(0.4);
  if (viaRadial && !(boundary && margin === 0)) {
    // 橈骨動脈が触知できない。触知できなければ脈拍は数えられない（SPEC §3.3 整合性制約）。
    // CRT は正常域にもし得る。「CRTは正常だが橈骨動脈が触知できない」症例は教育価値が高い。
    // ただし実測モードでは、その CRT も閾値付近にしてはならない
    return { radialPulsePalpable: false, pulseRate: null, crtSeconds: freeCrt(rng, profile, margin) };
  }
  const min = Number((profile.crtThresholdSeconds + margin).toFixed(1));
  const crtSeconds = boundary && margin === 0 ? profile.crtThresholdSeconds : rng.decimal(min, CRT_MAX, CRT_STEP);
  // CRT遅延があるなら脈拍は速い側に寄せる（生理学的整合）
  return { radialPulsePalpable: true, pulseRate: rng.int(100, 140), crtSeconds };
}

/**
 * 循環が評価されない症例でも提示する CRT。
 *
 * **実測モードではここにもマージンを効かせる。** 利用者はどの症例でも爪床を
 * 圧迫して測れてしまうため、判定に使わない症例であれ閾値付近の曖昧な値を
 * 見せてはならない（歩行可能な症例の呼吸数に `rrMild` を入れたのと同じ理由）。
 */
function freeCrt(rng: Rng, profile: RuleProfile, margin: number): number {
  if (margin <= 0) return rng.decimal(CRT_MIN, CRT_MAX, CRT_STEP);

  const passMax = Number((profile.crtThresholdSeconds - margin).toFixed(1));
  const failMin = Number((profile.crtThresholdSeconds + margin).toFixed(1));
  return rng.chance(0.5)
    ? rng.decimal(CRT_MIN, passMax, CRT_STEP)
    : rng.decimal(failMin, CRT_MAX, CRT_STEP);
}

/**
 * 循環が評価されない症例（より手前のステップで確定する）向け。
 * 判定に影響しないが、提示する値として矛盾がないようにする。
 */
function circulationFree(rng: Rng, profile: RuleProfile, margin: number): Circulation {
  if (profile.useRadialPulse && rng.chance(0.25)) {
    return { radialPulsePalpable: false, pulseRate: null, crtSeconds: freeCrt(rng, profile, margin) };
  }

  const crtSeconds = freeCrt(rng, profile, margin);
  // 脈拍 120 以上なら CRT は 1.5 秒以上（SPEC §3.3 整合性制約）。
  // 実測モードでは通過域の上限が 1.5 秒なので、CRT が速い症例では脈拍を 120 未満に抑える
  const pulseRate = crtSeconds >= 1.5 ? rng.int(50, 150) : rng.int(50, 119);
  return { radialPulsePalpable: true, pulseRate, crtSeconds };
}

/** 従命の可否と、従命できない場合の反応を一括で決める */
function consciousnessOf(
  rng: Rng,
  obeysCommands: boolean,
  hasSpontaneousBreathing: boolean,
): { obeysCommands: boolean; nonObeyingResponse: NonObeyingResponse | null } {
  return {
    obeysCommands,
    nonObeyingResponse: obeysCommands ? null : pickNonObeyingResponse(rng, hasSpontaneousBreathing),
  };
}

function rrPassRange(profile: RuleProfile, margin: number): [number, number] {
  return [profile.respiratoryRateLowMax + 1 + margin, profile.respiratoryRateHighMin - 1 - margin];
}

/** 呼吸数ステップを「通過」する値 */
function rrPass(rng: Rng, profile: RuleProfile, boundary: boolean, margin: number): number {
  const [min, max] = rrPassRange(profile, margin);
  if (max < min) {
    throw new RangeError(
      `rrMargin ${margin} が大きすぎる: 呼吸数の通過域が空になる（${min}..${max}）`,
    );
  }
  // margin > 0 のときは境界値を取らない（閾値から margin 以上離す制約が優先される）
  if (boundary && margin === 0) return rng.chance(0.5) ? min : max;
  return rng.int(min, max);
}

/**
 * 歩行可能な症例（III類）の呼吸数。軽症域と通過域の交差から抽選する。
 *
 * 歩行可能なら呼吸数は評価されないが、**実測モードでは利用者が胸郭の動きを見てしまう**。
 * どの症例であれ閾値付近の曖昧な値を提示してはならないため、マージンを尊重する。
 */
function rrMild(rng: Rng, profile: RuleProfile, margin: number): number {
  const [passMin, passMax] = rrPassRange(profile, margin);
  const min = Math.max(RR_MILD_RANGE[0], passMin);
  const max = Math.min(RR_MILD_RANGE[1], passMax);
  if (max < min) {
    throw new RangeError(`rrMargin ${margin} が大きすぎる: 軽症域が空になる（${min}..${max}）`);
  }
  return rng.int(min, max);
}

/** 呼吸数ステップに「該当」する値。下限域と上限域から選ぶ */
function rrFail(rng: Rng, profile: RuleProfile, boundary: boolean, margin: number): number {
  const lowMax = profile.respiratoryRateLowMax - margin;
  const lowAvailable = lowMax >= MIN_BREATHING_RR;
  const useLow = lowAvailable && rng.chance(0.4);

  if (useLow) {
    if (boundary && margin === 0) return profile.respiratoryRateLowMax;
    return rng.int(MIN_BREATHING_RR, lowMax);
  }

  const highMin = profile.respiratoryRateHighMin + margin;
  if (boundary && margin === 0) return profile.respiratoryRateHighMin;
  return rng.int(highMin, Math.max(highMin, Math.min(highMin + RR_HIGH_SPAN, RR_ABS_MAX)));
}

/**
 * 1症例を生成する。
 *
 * @throws {ImpossibleCombinationError} target と decidingStep の組み合わせが成立しない場合
 */
/**
 * イラストと状況文を決める。
 *
 * **状況文は候補から1つ抽選して症例に固定する。** 再描画のたびに文が変わると、
 * 計測の途中で表示が入れ替わってしまう。症例は生成後に不変であるべきである。
 */
function buildPatient(rng: Rng, illustration: Illustration): TriageCase['patient'] {
  return { illustrationId: illustration.id, situationKey: rng.pick(illustration.situationKeys) };
}

export function generateCase(options: GenerateOptions, rng: Rng): GeneratedCase {
  const profile = options.profile ?? JP_FDMA;
  const boundaryRate = options.boundaryRate ?? DEFAULT_BOUNDARY_RATE;
  const rrMargin = options.rrMargin ?? 0;
  const crtMargin = options.crtMargin ?? 0;
  const target = options.target;

  const decidingStep = options.decidingStep ?? rng.pick(decidingStepsFor(target));
  if (!VALID_COMBINATIONS.some((c) => c.target === target && c.decidingStep === decidingStep)) {
    throw new ImpossibleCombinationError(target, decidingStep);
  }

  const id = options.id ?? `case-${rng.int(0, 2_147_483_647).toString(36)}`;

  // --- 手順1: 歩行 ---
  if (decidingStep === 'walk') {
    const walkablePatient = buildPatient(rng, rng.pick(WALKABLE_ILLUSTRATIONS));
    // 歩行可能な症例は他のバイタルも軽症域で生成する（SPEC §3.3 整合性制約）
    return {
      case: {
        id,
        patient: walkablePatient,
        canWalk: true,
        hasSpontaneousBreathing: true,
        breathingAfterAirway: null,
        respiratoryRate: rrMild(rng, profile, rrMargin),
        radialPulsePalpable: true,
        pulseRate: rng.int(70, 100),
        // 歩行可能でも実測モードでは測られ得る。通過域に収めつつマージンを尊重する
        crtSeconds: circulationPass(rng, profile, false, crtMargin).crtSeconds,
        obeysCommands: true,
        nonObeyingResponse: null,
      },
      target,
      decidingStep,
      usedBoundary: false,
    };
  }

  const patient = buildPatient(rng, rng.pick(NON_WALKABLE_ILLUSTRATIONS));

  // --- 手順2: 自発呼吸と気道確保 ---
  if (decidingStep === 'airway') {
    const circulation = circulationFree(rng, profile, crtMargin);
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
        nonObeyingResponse: pickNonObeyingResponse(rng, false),
      },
      target,
      decidingStep,
      usedBoundary: false,
    };
  }

  // --- 手順3: 呼吸数 ---
  if (decidingStep === 'respiratoryRate') {
    // margin > 0 では閾値から離す制約が優先されるため、境界値は取り得ない
    const boundary = rrMargin === 0 && rng.chance(boundaryRate);
    const circulation = circulationFree(rng, profile, crtMargin);
    return {
      case: {
        id,
        patient,
        canWalk: false,
        hasSpontaneousBreathing: true,
        breathingAfterAirway: null,
        respiratoryRate: rrFail(rng, profile, boundary, rrMargin),
        ...circulation,
        ...consciousnessOf(rng, rng.chance(0.5), true),
      },
      target,
      decidingStep,
      usedBoundary: boundary,
    };
  }

  // 呼吸数ステップは通過させる。通過側の値にも独立に境界値バイアスをかける
  // （RR 29 を通過させてから循環で確定する症例は難度が高く、教育価値がある）
  const rrBoundary = rrMargin === 0 && rng.chance(boundaryRate);
  const respiratoryRate = rrPass(rng, profile, rrBoundary, rrMargin);

  // --- 手順4: 循環 ---
  if (decidingStep === 'circulation') {
    // margin > 0 では閾値から離す制約が優先されるため、境界値は取り得ない
    const crtBoundary = crtMargin === 0 && rng.chance(boundaryRate);
    return {
      case: {
        id,
        patient,
        canWalk: false,
        hasSpontaneousBreathing: true,
        breathingAfterAirway: null,
        respiratoryRate,
        ...circulationFail(rng, profile, crtBoundary, crtMargin),
        ...consciousnessOf(rng, rng.chance(0.5), true),
      },
      target,
      decidingStep,
      // 確定値そのものか、通過した呼吸数のどちらかが境界値なら境界値症例とみなす
      usedBoundary: crtBoundary || rrBoundary,
    };
  }

  // --- 手順5: 意識 ---
  // 意識は真偽値判定なので、ここでの「境界値」は通過した呼吸数・CRT が
  // 境界値であることを指す。どちらにもマージンが入ると成立しない
  const crtBoundary = crtMargin === 0 && rng.chance(boundaryRate);
  return {
    case: {
      id,
      patient,
      canWalk: false,
      hasSpontaneousBreathing: true,
      breathingAfterAirway: null,
      respiratoryRate,
      ...circulationPass(rng, profile, crtBoundary, crtMargin),
      ...consciousnessOf(rng, target === 'II', true),
    },
    target,
    decidingStep,
    usedBoundary: crtBoundary || rrBoundary,
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
  /** 実測モードの呼吸数マージン（既定 0）。docs/OBSERVATION.md */
  rrMargin?: number;
  /** 実測モードの CRT マージン（既定 0） */
  crtMargin?: number;
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
  const rrMargin = options.rrMargin ?? 0;
  const crtMargin = options.crtMargin ?? 0;

  const targets = [...QUIZ_COMPOSITION, rng.pick(['I', 'II', 'III', '0'] as const)];

  const items = rng.shuffle(targets).map((target, index) =>
    generateCase({ target, boundaryRate, profile, rrMargin, crtMargin, id: `quiz-${index + 1}` }, rng),
  );

  // 境界値症例が不足していれば境界値に差し替える。**区分の構成比は維持する**（target は変えない）。
  //
  // III類は walk、0類は airway でしか確定せず、どちらも真偽値判定なので境界値を持ち得ない。
  // そのため境界値の下限を満たすには、I類・II類側で確定ステップを境界値可能なものへ
  // 差し替える必要がある（I類4問すべてが airway を引くと上限3問で下限に届かない）。
  //
  // 呼吸数だけにマージンがある場合は循環・意識で境界値を作れる。
  // **呼吸数と CRT の両方にマージンがあると、どのステップも境界値を取れない。**
  // その場合はこのループが何も差し替えずに終わり、境界値 0 問のセットになる。
  // 実測モードでは境界値という概念自体が成立しないため、これを異常としない
  // （閾値を覚える訓練は数値モードが担う。docs/OBSERVATION.md §2）。
  let boundaryCount = items.filter((i) => i.usedBoundary).length;
  for (let i = 0; i < items.length && boundaryCount < QUIZ_MIN_BOUNDARY; i++) {
    const item = items[i];
    if (item === undefined || item.usedBoundary) continue;

    const capableSteps = boundaryCapableStepsFor(item.target, rrMargin, crtMargin);
    if (capableSteps.length === 0) continue; // III類・0類、および実測モードは対象外

    // 元の確定ステップが境界値を取れるならそれを維持し、取れないなら取れるものへ差し替える
    const decidingStep = canUseBoundary(item.decidingStep, rrMargin, crtMargin)
      ? item.decidingStep
      : rng.pick(capableSteps);

    items[i] = generateCase(
      { target: item.target, decidingStep, boundaryRate: 1, profile, rrMargin, crtMargin, id: item.case.id },
      rng,
    );
    boundaryCount++;
  }

  return items;
}

/**
 * 境界値を取り得る確定ステップか。
 *
 * - 歩行・気道確保は真偽値判定なので元から境界値が存在しない
 * - 呼吸数は `rrMargin > 0` で取れなくなる
 * - 循環は `crtMargin > 0` で取れなくなる
 * - 意識は真偽値だが、「通過した呼吸数・CRT が境界値である」ことを境界値と呼んでいる。
 *   どちらにもマージンが入ると成立しない
 *
 * したがって**実測モードでは全ステップが false になる**。
 */
export function canUseBoundary(step: DecidingStep, rrMargin = 0, crtMargin = 0): boolean {
  if (step === 'walk' || step === 'airway') return false;
  if (step === 'respiratoryRate') return rrMargin === 0;
  // 循環・意識は、確定値そのものか、通過した呼吸数・CRT のいずれかが境界値になり得る。
  // 両方にマージンが入って初めて不可能になる
  return rrMargin === 0 || crtMargin === 0;
}

/** その区分で境界値を取り得る確定ステップ。III類・0類と実測モードでは空になる */
export function boundaryCapableStepsFor(
  target: Category,
  rrMargin = 0,
  crtMargin = 0,
): DecidingStep[] {
  return decidingStepsFor(target).filter((step) => canUseBoundary(step, rrMargin, crtMargin));
}
