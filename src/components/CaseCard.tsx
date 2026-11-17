import { useCallback, useState } from 'react';
import type { CountResult } from '@/domain/tapCounting';
import type { TriageCase } from '@/domain/types';
import { PatientFigure } from '@/components/patients';
import { VitalsBar, shouldAnimateChest } from '@/components/vitals/VitalsBar';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';
import type { RrPresentation } from '@/lib/storage';

/**
 * 1症例の提示（SPEC §2.2, §5.1）。
 *
 * **スクロールなしで収める。** 高さに余裕があれば縦積み、足りなければ
 * イラストと所見の横並びに切り替える。判定はコンテナクエリ（`index.css` の
 * `@container pane`）で行い、JS でビューポートを測らない。
 *
 * **イラストが余った高さを吸収する。** 端末ごとの余りは呼吸アニメーションの
 * 視認性に回すのが最も価値が高いため。
 *
 * 気道確保ボタンの出し分けが提示方式で変わる:
 * - `numeric`  自発呼吸なしの症例のみ表示する。呼吸数 0 が同時に見えているため漏洩しない
 * - `observed` **全症例に表示する。** 呼吸数の数値が出ないため、ボタンの有無が
 *   観察前に無呼吸であることを漏らしてしまう（docs/OBSERVATION.md §3.1）
 */
export interface CaseCardProps {
  case: TriageCase;
  presentation: RrPresentation;
  onCountChange?: (result: CountResult) => void;
  /** 利用者が測った CRT を親へ渡す（解説での誤差提示に使う） */
  onCrtMeasured?: (seconds: number) => void;
}

export function CaseCard({ case: c, presentation, onCountChange, onCrtMeasured }: CaseCardProps) {
  const { t } = useI18n();
  const [airwayPerformed, setAirwayPerformed] = useState(false);
  const [measuredCrt, setMeasuredCrt] = useState<number | null>(null);

  const observed = presentation === 'observed';
  const showAirwayButton = observed || !c.hasSpontaneousBreathing;

  const handleBreathCounted = useCallback(
    (result: CountResult) => onCountChange?.(result),
    [onCountChange],
  );

  const handleCrtMeasured = useCallback(
    (seconds: number) => {
      setMeasuredCrt(seconds);
      onCrtMeasured?.(seconds);
    },
    [onCrtMeasured],
  );

  const airwayResultKey: TranslationKey = c.hasSpontaneousBreathing
    ? 'observation.airwayNotNeeded'
    : c.breathingAfterAirway === true
      ? 'observation.airwayResumed'
      : 'observation.airwayNoBreathing';

  return (
    <article className="case-layout flex min-h-0 flex-1 flex-col gap-2">
      {/* イラスト。余った高さを吸収する */}
      <div className="case-figure flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
        <PatientFigure
          case={c}
          animate={shouldAnimateChest(c, presentation)}
          className="min-h-0 w-full flex-1 text-slate-200"
        />
        <p className="shrink-0 text-center text-xs leading-tight text-slate-200">
          {t(c.patient.situationKey as TranslationKey)}
        </p>
      </div>

      <div className="case-info flex shrink-0 flex-col gap-1.5">
        <VitalsBar
          case={c}
          presentation={presentation}
          measuredCrt={measuredCrt}
          onCrtMeasured={handleCrtMeasured}
          onBreathCounted={handleBreathCounted}
          onPulseCounted={() => undefined}
        />

        {/* 計測器ではない項目。細い行にまとめる */}
        <div className="flex items-center justify-between gap-2 bg-slate-800 px-2 py-1">
          <p className="min-w-0 truncate text-xs">
            <span className="text-slate-400">{t('vital.commandsShort')} </span>
            <span className="font-medium">
              {c.obeysCommands ? t('vital.commands.follows') : t('vital.commands.doesNotFollow')}
            </span>
          </p>
          {showAirwayButton && (
            <button
              type="button"
              onClick={() => setAirwayPerformed(true)}
              disabled={airwayPerformed}
              className="min-h-9 shrink-0 border border-slate-500 bg-slate-700 px-2 text-[11px] font-medium text-slate-100 transition active:scale-95 disabled:opacity-45"
            >
              {t('observation.openAirway')}
            </button>
          )}
        </div>

        {airwayPerformed && (
          <p aria-live="polite" className="bg-slate-700 px-2 py-1 text-xs leading-tight text-slate-100">
            {t(airwayResultKey)}
          </p>
        )}
      </div>
    </article>
  );
}
