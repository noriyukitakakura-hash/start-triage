import { useCallback, useState } from 'react';
import { EMPTY_COUNT, computeCount, type CountResult } from '@/domain/tapCounting';
import type { TriageCase } from '@/domain/types';
import { useI18n } from '@/i18n';
import { formatSeconds } from '@/lib/format';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import './pulse.css';

/**
 * 橈骨動脈の触知（docs/OBSERVATION.md）。
 *
 * **判定に効くのは「触知できるか否か」である。** JP-FDMA の循環評価は
 * 「CRT ≧2秒 または 橈骨動脈 触知不能」であり、脈拍数は参考値にすぎない
 * （`src/domain/judge.ts`）。
 *
 * したがって触知不能の症例は**一切動かさない**。無呼吸の胸郭が全く動かないのと
 * 同じ構造で、静止そのものが手がかりになる。
 *
 * 脈拍数のタップ計数は現実性のために用意するが、回答の前提条件にはしない。
 * 計数の数理は呼吸と共通（`domain/tapCounting.ts`）。
 */
export interface PulseMeasureProps {
  case: TriageCase;
  onCounted: (result: CountResult) => void;
  count: CountResult;
}

export function PulseMeasure({ case: c, onCounted, count }: PulseMeasureProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [, setTapTimes] = useState<number[]>([]);

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
    <div className="space-y-2">
      <p className="text-sm text-slate-300">{t('pulse.instruction')}</p>

      <div className="flex justify-center">
        <svg viewBox="0 0 200 110" width={240} height={132} aria-hidden focusable="false">
          {/* 前腕と手。橈骨動脈は母指側の手首にある */}
          <path
            d="M8 38 L120 34 Q150 32 160 44 L188 46 Q196 52 188 58 L158 62 Q146 74 120 72 L8 70 Z"
            className="fill-[#e8c3a8] stroke-[#c99f82]"
            strokeWidth={2}
          />
          <path d="M118 36 L118 70" className="fill-none stroke-[#c99f82]" strokeWidth={2} />

          {/* 触知点。触知不能なら静止したまま */}
          <g
            className={[animate ? 'pulse-point' : '', palpable ? '' : 'pulse-point--absent']
              .filter(Boolean)
              .join(' ')}
            style={cycleSeconds !== null ? { animationDuration: `${cycleSeconds}s` } : undefined}
          >
            <circle cx={104} cy={44} r={9} className="pulse-point__ring" />
            <circle cx={104} cy={44} r={4} className="pulse-point__core" />
          </g>
          <line x1={104} y1={20} x2={104} y2={30} className="stroke-slate-400" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>

      <p aria-live="polite" className="text-center text-sm">
        {palpable ? (
          <span className="text-slate-300">{t('pulse.palpable')}</span>
        ) : (
          <span className="text-amber-300">{t('pulse.notPalpable')}</span>
        )}
      </p>

      {palpable && (
        <>
          <p className="text-center font-mono text-xs tabular-nums text-slate-400">
            {count.taps === 0
              ? ' '
              : `${t('observation.elapsedValue', { seconds: formatSeconds(count.spanMs) })} · ${t(
                  'observation.tapsValue',
                  { count: count.taps },
                )} · ${
                  count.estimatedRate === null
                    ? t('observation.needMoreTaps')
                    : t('pulse.measured', { rate: count.estimatedRate })
                }`}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={tap}
              className="min-h-12 flex-1 bg-sky-600 text-sm font-semibold text-white transition active:scale-95"
            >
              {t('pulse.tap')}
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label={t('observation.reset')}
              disabled={count.taps === 0}
              className="min-h-12 w-11 shrink-0 border border-slate-600 text-base text-slate-300 transition active:scale-95 disabled:opacity-45"
            >
              <span aria-hidden>↺</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
