import { GASPS_PER_LOOP, agonalLoopSeconds, breathCycleSeconds } from '@/domain/breathing';
import type { BreathingPattern } from '@/domain/breathing';

/**
 * 呼吸パターンを CSS アニメーションのパラメータへ対応づける（表示層の責務）。
 *
 * パターンの分類自体は `domain/breathing.ts` が担う。ここは見た目だけを扱う。
 */

export interface BreathAnimation {
  /** `breathing.css` のキーフレーム名に対応する修飾クラス。規則呼吸では null */
  modifierClass: 'chest--agonal' | null;
  /** CSS の animation-duration に渡す秒数 */
  durationSeconds: number;
  /** --breath-amp に渡す振幅 */
  amplitude: number;
  /** 1ループに含まれる呼吸回数。平均レートの検証に使う */
  breathsPerLoop: number;
}

/**
 * 振幅。
 *
 * **生理学的な胸郭の変位より誇張してある。** 実際の呼吸による胸郭の動きは数%だが、
 * スマートフォン画面でその振幅では数えられず、実測モードが機能しない。
 * 視認性を優先し、パターン間の相対関係（浅い/深い）を保ったまま拡大している。
 */
export const BREATH_AMPLITUDE: Record<Exclude<BreathingPattern, 'apneic'>, number> = {
  /** 規則的 */
  normal: 1.12,
  /** 浅く速い */
  rapidShallow: 1.06,
  /** 深い喘ぎ */
  agonal: 1.18,
};

/**
 * 呼吸アニメーションのパラメータを返す。
 * 無呼吸（`apneic`）は null を返し、呼び出し側はアニメーションを一切付与しない。
 * **静止そのものが手がかりである。**
 */
export function breathAnimationFor(
  pattern: BreathingPattern,
  respiratoryRate: number | null,
): BreathAnimation | null {
  if (pattern === 'apneic') return null;
  if (respiratoryRate === null || respiratoryRate <= 0) return null;

  if (pattern === 'agonal') {
    return {
      modifierClass: 'chest--agonal',
      durationSeconds: agonalLoopSeconds(respiratoryRate),
      amplitude: BREATH_AMPLITUDE.agonal,
      breathsPerLoop: GASPS_PER_LOOP,
    };
  }

  return {
    modifierClass: null,
    durationSeconds: breathCycleSeconds(respiratoryRate),
    amplitude: BREATH_AMPLITUDE[pattern],
    breathsPerLoop: 1,
  };
}

/** アニメーションが表現している毎分の呼吸回数。真値との一致をテストで検証する */
export function effectiveRateOf(animation: BreathAnimation): number {
  return (animation.breathsPerLoop / animation.durationSeconds) * 60;
}
