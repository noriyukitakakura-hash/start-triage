import { useCallback, useState } from 'react';
import { EMPTY_COUNT, computeCount, type CountResult } from '@/domain/tapCounting';
import type { TriageCase } from '@/domain/types';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { Instrument, InstrumentButton } from './Instrument';

/**
 * 橈骨動脈の触知（docs/OBSERVATION.md §3.5）。
 *
 * **判定に効くのは触知可否である。** 循環評価は CRT か橈骨動脈触知不能で決まり、
 * 脈拍数は参考値にすぎない。したがって触知不能の症例は**一切動かさない**。
 * 無呼吸の胸郭が全く動かないのと同じ構造で、静止そのものが手がかりになる。
 *
 * 計数の数理は呼吸と共通（`domain/tapCounting.ts`）。
 */
export interface PulseInstrumentProps {
  case: TriageCase;
  onCounted: (result: CountResult) => void;
}

export function PulseInstrument({ case: c, onCounted }: PulseInstrumentProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const result = computeCount(tapTimes);

  const palpable = c.radialPulsePalpable;
  // 触知可なら必ず脈拍を持つ（generator の整合性制約）
  const cycleSeconds = palpable && c.pulseRate !== null ? 60 / c.pulseRate : null;
  const animate = cycleSeconds !== null && !prefersReducedMotion;

  const tap = useCallback(() => {
    setTapTimes((previous) => {
      const next = [...previous, performance.now()];
      onCounted(computeCount(next));
      return next;
    });
  }, [onCounted]);

  const reset = useCallback(() => {
    setTapTimes([]);
    onCounted(EMPTY_COUNT);
  }, [onCounted]);

  return (
    <Instrument
      label={t('vital.radialPulse')}
      figure={
        <svg viewBox="0 0 70 50" width={70} height={50} aria-hidden focusable="false">
          {/* 手首と母指側。橈骨動脈はこの位置にある */}
          <path
            d="M2 14 L42 12 Q54 11 58 17 L68 18 Q70 21 68 24 L57 25 Q52 32 42 31 L2 30 Z"
            className="fill-[#e8c3a8] stroke-[#c99f82]"
            strokeWidth={1.5}
          />
          <line x1={30} y1={4} x2={30} y2={9} className="stroke-slate-400" strokeWidth={1.5} strokeLinecap="round" />
          <g
            className={[animate ? 'pulse-point' : '', palpable ? '' : 'pulse-point--absent']
              .filter(Boolean)
              .join(' ')}
            style={cycleSeconds !== null ? { animationDuration: `${cycleSeconds}s` } : undefined}
          >
            <circle cx={30} cy={21} r={7} className="pulse-point__ring" />
            <circle cx={30} cy={21} r={3} className="pulse-point__core" />
          </g>
        </svg>
      }
      readout={
        <span aria-live="polite" className="text-center text-[11px] leading-tight">
          {!palpable ? (
            <span className="text-amber-300">{t('pulse.absentShort')}</span>
          ) : result.estimatedRate === null ? (
            <span className="font-mono tabular-nums text-slate-400">
              {result.taps === 0 ? '—' : t('observation.tapsValue', { count: result.taps })}
            </span>
          ) : (
            <button
              type="button"
              onClick={reset}
              aria-label={t('observation.reset')}
              className="inline-flex min-h-6 items-center px-1 font-mono text-sm font-semibold tabular-nums"
            >
              {t('pulse.measured', { rate: result.estimatedRate })}
            </button>
          )}
        </span>
      }
      action={
        palpable ? (
          <InstrumentButton onClick={tap}>{t('pulse.tapShort')}</InstrumentButton>
        ) : (
          /*
            **空欄のままにしない。** 触知不能では拍動も動かずボタンも出ないため、
            操作欄が 44px の空白になり故障に見える。
            所見であることを明示する（値は漏らさない。「触れない」は既に出ている）
          */
          <p className="flex h-11 items-center justify-center text-center text-[11px] leading-tight text-slate-400">
            {t('pulse.absentHint')}
          </p>
        )
      }
    />
  );
}
