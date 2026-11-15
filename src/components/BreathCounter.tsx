import { useCallback, useState, type ReactNode } from 'react';
import { MIN_ESTIMATE_MS, estimateRate } from '@/domain/breathing';
import { useI18n } from '@/i18n';
import { formatSeconds } from '@/lib/format';

/**
 * 呼吸のタップ計数（docs/OBSERVATION.md §6）。
 *
 * **計測窓は最初のタップから最後のタップまで。** 症例の表示時刻を起点にすると、
 * 状況文を読んでいる時間が経過時間に入って推定値が過小になる。また利用者が
 * 数え終えて判断に迷っている間も経過時間だけが伸び、表示中の推定値が
 * 勝手に下がり続けてしまう。タップ間隔から求めれば、タップを止めた時点で
 * 表示が自然に止まる。
 *
 * **N回のタップは N-1 個の間隔を張る。** 1回目のタップを1呼吸と数えると
 * 必ず1回分多く見積もってしまう（いわゆる柵と杭の数え間違い）ため、
 * 間隔の数で割る。
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

export interface BreathCounterProps {
  /** 症例が変わったら計数をやり直せるよう、呼び出し側が key で再マウントする */
  onChange: (result: CountResult) => void;
  disabled?: boolean;
  /** 気道確保ボタン。同じ行に並べて高さを節約する */
  airwayAction?: ReactNode;
}

/**
 * スクロールなしで収めるため 1〜2 行のバーに収めている（SPEC §5.1）。
 * 計数の数理（{@link computeCount}）はレイアウトから独立しており、変更していない。
 */
export function BreathCounter({ onChange, disabled = false, airwayAction }: BreathCounterProps) {
  const { t } = useI18n();
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  const result = computeCount(tapTimes);

  const tap = useCallback(() => {
    setTapTimes((previous) => {
      const next = [...previous, performance.now()];
      onChange(computeCount(next));
      return next;
    });
  }, [onChange]);

  const reset = useCallback(() => {
    setTapTimes([]);
    onChange(EMPTY_COUNT);
  }, [onChange]);

  return (
    <section aria-label={t('observation.heading')} className="space-y-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={tap}
          disabled={disabled}
          className="min-h-12 flex-1 rounded-xl bg-sky-600 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-45"
        >
          {t('observation.tap')}
        </button>
        {airwayAction}
        <button
          type="button"
          onClick={reset}
          aria-label={t('observation.reset')}
          disabled={disabled || result.taps === 0}
          className="min-h-12 w-11 shrink-0 rounded-xl border border-slate-600 text-base text-slate-300 transition active:scale-95 disabled:opacity-45"
        >
          <span aria-hidden>↺</span>
        </button>
      </div>

      <p
        aria-live="polite"
        className="text-center font-mono text-xs leading-tight tabular-nums text-slate-400"
      >
        {result.taps === 0 ? (
          t('observation.instruction')
        ) : (
          <>
            {t('observation.elapsedValue', { seconds: formatSeconds(result.spanMs) })}
            {' · '}
            {t('observation.tapsValue', { count: result.taps })}
            {' · '}
            {result.estimatedRate === null
              ? t('observation.needMoreTaps')
              : t('observation.estimatedValue', { rate: result.estimatedRate })}
          </>
        )}
      </p>
    </section>
  );
}
