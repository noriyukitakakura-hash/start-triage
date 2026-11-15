import { useCallback, useState } from 'react';
import type { TriageCase } from '@/domain/types';
import { PatientFigure } from '@/components/patients';
import { BreathCounter, type CountResult } from '@/components/BreathCounter';
import { VitalsPanel, shouldAnimateChest } from '@/components/VitalsPanel';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';
import type { RrPresentation } from '@/lib/storage';

/**
 * 1症例の提示（SPEC §2.2, §5.1）。
 *
 * **スクロールなしで収める。** 高さに余裕があれば縦積み、足りなければ
 * イラストと所見の横並びに切り替える。判定はコンテナクエリ（`index.css` の
 * `@container pane`）で行い、JS でビューポートを測らない。
 * 端末の向きではなく**実際に使える高さ**で切り替えるため、ウィンドウ分割や
 * ブラウザのツールバーによる高さの変化にも正しく追従する。
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
}

export function CaseCard({ case: c, presentation, onCountChange }: CaseCardProps) {
  const { t } = useI18n();
  const [airwayPerformed, setAirwayPerformed] = useState(false);

  const observed = presentation === 'observed';
  const showAirwayButton = observed || !c.hasSpontaneousBreathing;

  const handleCount = useCallback((result: CountResult) => onCountChange?.(result), [onCountChange]);

  const airwayResultKey: TranslationKey = c.hasSpontaneousBreathing
    ? 'observation.airwayNotNeeded'
    : c.breathingAfterAirway === true
      ? 'observation.airwayResumed'
      : 'observation.airwayNoBreathing';

  const airwayButton = showAirwayButton ? (
    <button
      type="button"
      onClick={() => setAirwayPerformed(true)}
      disabled={airwayPerformed}
      className="min-h-12 shrink-0 rounded-xl border border-slate-500 bg-slate-700 px-3 text-xs font-medium text-slate-100 transition active:scale-95 disabled:opacity-45"
    >
      {t('observation.openAirway')}
    </button>
  ) : null;

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

      {/* 計測と所見 */}
      <div className="case-info flex shrink-0 flex-col gap-1.5">
        {observed ? (
          <BreathCounter onChange={handleCount} airwayAction={airwayButton} />
        ) : (
          airwayButton !== null && <div className="flex">{airwayButton}</div>
        )}

        {airwayPerformed && (
          <p
            aria-live="polite"
            className="rounded-md bg-slate-700 px-2 py-1 text-xs leading-tight text-slate-100"
          >
            {t(airwayResultKey)}
          </p>
        )}

        <VitalsPanel case={c} presentation={presentation} />
      </div>
    </article>
  );
}
