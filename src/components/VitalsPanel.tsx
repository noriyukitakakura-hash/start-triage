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
 * 呼吸数の扱いが提示方式で変わる:
 * - `numeric`  数値で表示する
 * - `observed` 画面には出さない。胸郭アニメーションを数えて判断する。
 *   ただし **支援技術には常に数値を渡す**（docs/OBSERVATION.md §3.5）
 */
export interface VitalsPanelProps {
  case: TriageCase;
  presentation: RrPresentation;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-800 px-2 py-1">
      <dt className="truncate text-[11px] leading-tight text-slate-400">{label}</dt>
      <dd className="truncate font-mono text-base leading-tight tabular-nums">{value}</dd>
    </div>
  );
}

export function VitalsPanel({ case: c, presentation }: VitalsPanelProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();

  const observed = presentation === 'observed';
  const showRrNumber = !observed || prefersReducedMotion;

  const rrText =
    c.respiratoryRate === null || !c.hasSpontaneousBreathing
      ? t('vital.breathing.absent')
      : `${c.respiratoryRate} ${t('vital.respiratoryRate.unit')}`;

  return (
    <div className="space-y-1">
      {observed && prefersReducedMotion && (
        <p className="rounded-md bg-slate-700 px-2 py-1 text-[11px] leading-tight text-slate-200">
          {t('observation.reducedMotionFallback')}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-1">
        {showRrNumber ? (
          <Cell label={t('vital.respiratoryRate')} value={rrText} />
        ) : (
          /* 実測モードでも支援技術には数値を渡す（代替手段。SPEC §5.3） */
          <div className="sr-only">
            <dt>{t('vital.respiratoryRate')}</dt>
            <dd>{rrText}</dd>
          </div>
        )}

        <Cell
          label={t('vital.radialPulse')}
          value={c.radialPulsePalpable ? t('vital.radialPulse.palpable') : t('vital.radialPulse.absent')}
        />
        <Cell
          label={t('vital.pulseRate')}
          value={
            c.pulseRate === null
              ? t('vital.pulseRate.uncountable')
              : `${c.pulseRate} ${t('vital.pulseRate.unit')}`
          }
        />
        <Cell label={t('vital.crt')} value={`${c.crtSeconds.toFixed(1)} ${t('vital.crt.unit')}`} />
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
