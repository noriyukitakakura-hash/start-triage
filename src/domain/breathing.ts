import type { TriageCase } from './types';

/**
 * 呼吸の観察（実測モード）に必要な臨床的導出。詳細は docs/OBSERVATION.md
 *
 * この層は表示文字列を持たず、アニメーションの見た目（振幅・色・px）も扱わない。
 * パターンの分類までを担い、描画パラメータへの対応づけは表示層
 * （`components/patients/breathing.ts`）が行う。
 */

export const BREATHING_PATTERNS = ['apneic', 'agonal', 'normal', 'rapidShallow'] as const;
export type BreathingPattern = (typeof BREATHING_PATTERNS)[number];

/**
 * 呼吸パターンの臨床分類。
 *
 * - `apneic`      自発呼吸なし。胸郭は全く動かない
 * - `agonal`      死戦期呼吸。深く不規則な喘ぎと長い休止（呼吸数が下限閾値以下）
 * - `normal`      基準内
 * - `rapidShallow` 浅く速い（呼吸数が上限閾値以上）
 *
 * 閾値は `RuleProfile` ではなく**生理学的な区切り**を使う。パターンは見た目の分類であり、
 * トリアージ判定の基準値とは別概念である（判定は必ず `judge()` が `RuleProfile` で行う）。
 */
export const AGONAL_MAX_RATE = 9;
export const RAPID_MIN_RATE = 30;

export function breathingPatternOf(c: TriageCase): BreathingPattern {
  if (!c.hasSpontaneousBreathing) return 'apneic';
  // 自発呼吸がある症例の呼吸数は必ず 1 以上（generator の整合性制約）
  const rr = c.respiratoryRate ?? 0;
  if (rr <= 0) return 'apneic';
  if (rr <= AGONAL_MAX_RATE) return 'agonal';
  if (rr >= RAPID_MIN_RATE) return 'rapidShallow';
  return 'normal';
}

/**
 * 1呼吸周期の秒数。CSS の `animation-duration` にそのまま渡す。
 *
 * **アニメーションは厳密に毎分 `rr` 回でなければならない。**
 * 利用者のタップ数が真の呼吸数と一致しなければ、誤った数値を教えることになる。
 */
export function breathCycleSeconds(rr: number): number {
  if (rr <= 0) throw new Error(`breathCycleSeconds: 呼吸数 ${rr} に周期は存在しない`);
  return 60 / rr;
}

/**
 * 死戦期呼吸の1ループに含める呼吸回数。
 *
 * 不規則な間隔を表現するため複数回を1ループにまとめるが、
 * ループ長を `GASPS_PER_LOOP × breathCycleSeconds(rr)` 秒とすることで
 * **平均レートは厳密に rr を保つ**。
 */
export const GASPS_PER_LOOP = 3;

/** 死戦期呼吸のループ秒数。平均レートが rr と厳密に一致する */
export function agonalLoopSeconds(rr: number): number {
  return GASPS_PER_LOOP * breathCycleSeconds(rr);
}

/** 経過時間に対して観察されるべき呼吸回数（小数）。タップ計数の採点に使う */
export function expectedBreathCount(rr: number, elapsedMs: number): number {
  if (elapsedMs < 0) throw new Error(`expectedBreathCount: 経過時間 ${elapsedMs}ms が負`);
  if (rr <= 0) return 0;
  return (rr * elapsedMs) / 60_000;
}

/**
 * タップ数と経過時間から毎分換算値を求める。
 *
 * 臨床の「T秒数えて 60/T を掛ける」方法に対応する。
 * 経過時間が極端に短いと過大な値になるため、呼び出し側は
 * {@link MIN_ESTIMATE_MS} 未満では推定値を表示しないこと。
 */
export const MIN_ESTIMATE_MS = 3_000;

export function estimateRate(taps: number, elapsedMs: number): number {
  if (taps < 0) throw new Error(`estimateRate: タップ数 ${taps} が負`);
  if (elapsedMs <= 0) return 0;
  return Math.round((taps * 60_000) / elapsedMs);
}

/**
 * 推定値が十分に信頼できる経過時間か。
 * 実測モードの UI は、これが false の間は推定値を出さず経過時間のみ表示する。
 */
export function isEstimateReliable(elapsedMs: number): boolean {
  return elapsedMs >= MIN_ESTIMATE_MS;
}
