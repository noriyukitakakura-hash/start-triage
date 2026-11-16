import { breathingPatternOf } from '@/domain/breathing';
import type { TriageCase } from '@/domain/types';
import { useI18n } from '@/i18n';
import type { RrPresentation } from '@/lib/storage';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

/**
 * バイタルの提示（SPEC §2.2, §5.1）。
 *
 * スクロールなしで収めるため 2 列グリッドにしている。`<dl>` 構造は維持し、
 * スクリーンリーダーでの読み上げ順（項目名 → 値）を壊さない（SPEC §5.3）。
 *
 * 実測モードでは呼吸数・CRT・脈拍の真の値を画面に出さない。
 * CRT と橈骨動脈のセルは**計測シートを開くボタン**になり、利用者が自分で測る。
 * **支援技術には常に真の値を渡す**。計測が行えない利用者に対する代替手段が要るため
 * （docs/OBSERVATION.md §3.5）。
 */
export interface VitalsPanelProps {
  case: TriageCase;
  presentation: RrPresentation;
  /** 実測モードで利用者が測った CRT（秒）。未測定は null */
  measuredCrt?: number | null;
  /** 実測モードで利用者が数えた脈拍（回/分）。未測定は null */
  measuredPulse?: number | null;
  onMeasureCrt?: () => void;
  onMeasurePulse?: () => void;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-slate-800 px-2 py-1">
      <dt className="truncate text-[11px] leading-tight text-slate-400">{label}</dt>
      <dd className="truncate font-mono text-base leading-tight tabular-nums">{value}</dd>
    </div>
  );
}

/** 計測シートを開くセル。未測定か、自分が測った値かを示す */
function MeasureCell({
  label,
  value,
  measured,
  onClick,
}: {
  label: string;
  value: string;
  measured: boolean;
  onClick: () => void;
}) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-1 bg-slate-800 px-2 py-1 text-left transition active:scale-95"
      >
        <span className="min-w-0">
          <span className="block truncate text-[11px] leading-tight text-slate-400">{label}</span>
          <span
            className={[
              'block truncate font-mono text-base leading-tight tabular-nums',
              measured ? '' : 'text-slate-500',
            ].join(' ')}
          >
            {value}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-slate-500">
          ▸
        </span>
      </button>
    </div>
  );
}

export function VitalsPanel({
  case: c,
  presentation,
  measuredCrt = null,
  measuredPulse = null,
  onMeasureCrt,
  onMeasurePulse,
}: VitalsPanelProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();

  const observed = presentation === 'observed';
  const showTrueValues = !observed || prefersReducedMotion;

  const rrText =
    c.respiratoryRate === null || !c.hasSpontaneousBreathing
      ? t('vital.breathing.absent')
      : `${c.respiratoryRate} ${t('vital.respiratoryRate.unit')}`;
  const crtText = `${c.crtSeconds.toFixed(1)} ${t('vital.crt.unit')}`;
  const pulseText =
    c.pulseRate === null
      ? t('vital.pulseRate.uncountable')
      : `${c.pulseRate} ${t('vital.pulseRate.unit')}`;
  const radialText = c.radialPulsePalpable
    ? t('vital.radialPulse.palpable')
    : t('vital.radialPulse.absent');

  return (
    <div className="space-y-1">
      {observed && prefersReducedMotion && (
        <p className="bg-slate-700 px-2 py-1 text-[11px] leading-tight text-slate-200">
          {t('observation.reducedMotionFallback')}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-1">
        {showTrueValues ? (
          <>
            <Cell label={t('vital.respiratoryRate')} value={rrText} />
            <Cell label={t('vital.radialPulse')} value={radialText} />
            <Cell label={t('vital.pulseRate')} value={pulseText} />
            <Cell label={t('vital.crt')} value={crtText} />
          </>
        ) : (
          <>
            {/* 実測モードでも支援技術には真の値を渡す（代替手段。SPEC §5.3） */}
            <div className="sr-only">
              <dt>{t('vital.respiratoryRate')}</dt>
              <dd>{rrText}</dd>
              <dt>{t('vital.radialPulse')}</dt>
              <dd>{radialText}</dd>
              <dt>{t('vital.pulseRate')}</dt>
              <dd>{pulseText}</dd>
              <dt>{t('vital.crt')}</dt>
              <dd>{crtText}</dd>
            </div>
            <MeasureCell
              label={t('vital.radialPulse')}
              value={measuredPulse === null ? t('pulse.measure') : t('pulse.measured', { rate: measuredPulse })}
              measured={measuredPulse !== null}
              onClick={() => onMeasurePulse?.()}
            />
            <MeasureCell
              label={t('vital.crt')}
              value={
                measuredCrt === null
                  ? t('crt.notMeasured')
                  : `${measuredCrt.toFixed(1)} ${t('vital.crt.unit')}`
              }
              measured={measuredCrt !== null}
              onClick={() => onMeasureCrt?.()}
            />
          </>
        )}

        <Cell
          label={t('vital.commands')}
          value={c.obeysCommands ? t('vital.commands.follows') : t('vital.commands.doesNotFollow')}
        />
      </dl>
    </div>
  );
}

/** 実測モードで胸郭を動かすべきか（無呼吸は動かさない。静止が手がかり） */
export function shouldAnimateChest(c: TriageCase, presentation: RrPresentation): boolean {
  return presentation === 'observed' && breathingPatternOf(c) !== 'apneic';
}
