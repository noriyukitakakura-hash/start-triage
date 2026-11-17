import { useCallback, useState } from 'react';
import { EMPTY_COUNT, computeCount, type CountResult } from '@/domain/tapCounting';
import { useI18n } from '@/i18n';
import { formatSeconds } from '@/lib/format';
import { Instrument, InstrumentButton } from './Instrument';

/**
 * 呼吸の計測（docs/OBSERVATION.md §6）。
 *
 * **このセルに図を置かない。** 胸郭は上の傷病者イラストで動いており、
 * 同じ情報を二重に出すとどちらを数えるのか迷わせる。
 *
 * 計数の数理は `domain/tapCounting.ts`。脈拍と共通で、別実装を持たない。
 */
export interface BreathInstrumentProps {
  onChange: (result: CountResult) => void;
}

export function BreathInstrument({ onChange }: BreathInstrumentProps) {
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
    <Instrument
      label={t('vital.respiratoryRate')}
      figure={
        <div className="text-center font-mono text-[11px] leading-tight tabular-nums text-slate-400">
          {result.taps === 0 ? (
            <span className="text-slate-500">{t('observation.instructionShort')}</span>
          ) : (
            <>
              <span className="block">
                {t('observation.elapsedValue', { seconds: formatSeconds(result.spanMs) })}
              </span>
              <span className="block">{t('observation.tapsValue', { count: result.taps })}</span>
              <button
                type="button"
                onClick={reset}
                aria-label={t('observation.reset')}
                className="mt-0.5 text-slate-500 underline"
              >
                <span aria-hidden>↺</span>
              </button>
            </>
          )}
        </div>
      }
      readout={
        <span aria-live="polite" className="font-mono text-sm font-semibold tabular-nums">
          {result.estimatedRate === null ? (
            <span className="text-xs font-normal text-slate-600">—</span>
          ) : (
            t('observation.estimatedValue', { rate: result.estimatedRate })
          )}
        </span>
      }
      action={<InstrumentButton onClick={tap}>{t('observation.tap')}</InstrumentButton>}
    />
  );
}
