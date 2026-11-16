import type { RuleProfile } from './types';

/**
 * 循環（CRT）の実測に関する数理（docs/OBSERVATION.md）。
 *
 * 現場の手技は「爪床を5秒間圧迫し、離してから色が戻るまでの秒数を数える」。
 * 圧迫が足りなければ毛細血管が十分に空にならず、正しく測れない。
 * そのため**圧迫時間を満たさない計測は無効として扱う**。
 */

/** 爪床を圧迫し続けるべき秒数。現場の手技に合わせる */
export const CRT_PRESS_SECONDS = 5;

/**
 * 実測モードで CRT を判定閾値から離す秒数。
 *
 * 目視での計測誤差は人間の反応時間からおよそ ±0.3 秒ある。
 * 閾値 2.0 秒に対して 1.9 秒と 2.0 秒は区別できないため、
 * 誤差を超える差を確保する。呼吸数の `rrMargin` と同じ考え方。
 */
export const MEASURED_CRT_MARGIN = 0.5;

/** 圧迫時間が手技として十分か */
export function isPressSufficient(pressMs: number): boolean {
  return pressMs >= CRT_PRESS_SECONDS * 1000;
}

/**
 * 離してから「色が戻った」と申告するまでの秒数。
 * 申告が離す前の時刻になることはないが、時刻の取り違えで負にならないよう丸める。
 */
export function estimateCrtSeconds(releasedAt: number, reportedAt: number): number {
  const seconds = Math.max(0, reportedAt - releasedAt) / 1000;
  return Number(seconds.toFixed(1));
}

/**
 * CRT が属する帯。「測り間違えたが帯の判断は正しい」を切り分けるために使う。
 * 境界は `RuleProfile` から取り、`judge` と同じ基準であることを保証する。
 */
export const CRT_BANDS = ['withinRange', 'delayed'] as const;
export type CrtBand = (typeof CRT_BANDS)[number];

export function crtBandOf(seconds: number, profile: RuleProfile): CrtBand {
  return seconds >= profile.crtThresholdSeconds ? 'delayed' : 'withinRange';
}
