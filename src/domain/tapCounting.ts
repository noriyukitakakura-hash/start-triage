import { MIN_ESTIMATE_MS, estimateRate } from './breathing';

/**
 * タップ計数の数理（docs/OBSERVATION.md §6）。
 *
 * 呼吸と脈拍の双方で使う。どちらも「周期的な現象をタップで数え、毎分に換算する」
 * という同じ問題であり、別実装を持つ理由がない。
 *
 * **計測窓は最初のタップから最後のタップまで。** 対象が提示された時刻を起点にすると、
 * 状況を読んでいる時間が入って推定値が過小になる。また数え終えて判断に迷っている間も
 * 経過だけが伸び、表示中の推定値が勝手に下がり続けてしまう。
 * タップ間隔から求めれば、タップを止めた時点で表示が自然に止まる。
 *
 * **N回のタップは N-1 個の間隔を張る。** 1回目を1回と数えると必ず1回分多く
 * 見積もってしまう（いわゆる柵と杭の数え間違い）ため、間隔の数で割る。
 */

/** 推定値を出すのに必要な最小タップ数。間隔が2つ以上ないとばらつきが大きい */
export const MIN_TAPS_FOR_ESTIMATE = 3;

export interface CountResult {
  taps: number;
  /** 最初のタップから最後のタップまで（ミリ秒） */
  spanMs: number;
  /** 毎分換算した推定値。信頼できる長さに達していなければ null */
  estimatedRate: number | null;
}

export const EMPTY_COUNT: CountResult = { taps: 0, spanMs: 0, estimatedRate: null };

export function computeCount(tapTimes: readonly number[]): CountResult {
  const taps = tapTimes.length;
  if (taps < 2) return { taps, spanMs: 0, estimatedRate: null };

  const first = tapTimes[0] as number;
  const last = tapTimes[taps - 1] as number;
  const spanMs = last - first;

  const reliable = taps >= MIN_TAPS_FOR_ESTIMATE && spanMs >= MIN_ESTIMATE_MS;
  // N回のタップが張る間隔は N-1 個
  return { taps, spanMs, estimatedRate: reliable ? estimateRate(taps - 1, spanMs) : null };
}
