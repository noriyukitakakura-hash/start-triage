import { useCallback, useState, type ReactNode } from 'react';
import { EMPTY_COUNT, computeCount, type CountResult } from '@/domain/tapCounting';
import { useI18n } from '@/i18n';
import { formatSeconds } from '@/lib/format';

/**
 * 呼吸のタップ計数（docs/OBSERVATION.md §6）。
 *
 * 計数の数理は `domain/tapCounting.ts` にある。脈拍の計数と同じ問題であり、
 * 別実装を持たない。
 */

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
