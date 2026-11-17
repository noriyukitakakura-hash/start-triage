import { breathingPatternOf } from '@/domain/breathing';
import type { CountResult } from '@/domain/tapCounting';
import type { TriageCase } from '@/domain/types';
import { useI18n } from '@/i18n';
import type { RrPresentation } from '@/lib/storage';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { BreathInstrument } from './BreathInstrument';
import { CrtInstrument } from './CrtInstrument';
import { PulseInstrument } from './PulseInstrument';
import './vitals.css';

/**
 * 計測器の行（SPEC §2.2, §5.1）。
 *
 * 呼吸・CRT・脈拍を**常時表示**で横 3 列に並べる。
 * 爪床の色も脈の拍動も、傷病者を前にすれば常に目に入る情報であり、
 * 開かないと見えないのは現場の再現として不自然であるため。
 *
 * **数値モードも同じ枠を使う。** 計測器の代わりに数値を入れる。
 * モードを切り替えても配置が変わらず、視線の置き場所が変わらない。
 *
 * 実測モードでも**支援技術には常に真の値を渡す**。計測が行えない利用者に対する
 * 代替手段が要るため（docs/OBSERVATION.md §3.7）。
 */
export interface VitalsBarProps {
  case: TriageCase;
  presentation: RrPresentation;
  measuredCrt: number | null;
  onCrtMeasured: (seconds: number) => void;
  onBreathCounted: (result: CountResult) => void;
  onPulseCounted: (result: CountResult) => void;
}

export function VitalsBar({
  case: c,
  presentation,
  measuredCrt,
  onCrtMeasured,
  onBreathCounted,
  onPulseCounted,
}: VitalsBarProps) {
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
      ? t('vital.radialPulse.absent')
      : `${c.pulseRate} ${t('vital.pulseRate.unit')}`;

  return (
    <div className="space-y-1">
      {observed && prefersReducedMotion && (
        <p className="bg-slate-700 px-2 py-1 text-[11px] leading-tight text-slate-200">
          {t('observation.reducedMotionFallback')}
        </p>
      )}

      {/* 実測モードでも支援技術には真の値を渡す（代替手段。SPEC §5.3） */}
      {!showTrueValues && (
        <dl className="sr-only">
          <dt>{t('vital.respiratoryRate')}</dt>
          <dd>{rrText}</dd>
          <dt>{t('vital.crt')}</dt>
          <dd>{crtText}</dd>
          <dt>{t('vital.radialPulse')}</dt>
          <dd>{pulseText}</dd>
        </dl>
      )}

      {showTrueValues ? (
        /* 数値モードは定義リストで読み上げられるようにする（SPEC §5.3） */
        <dl className="grid grid-cols-3 gap-1">
          <ValueInstrument label={t('vital.respiratoryRate')} value={rrText} />
          <ValueInstrument label={t('vital.crt')} value={crtText} />
          <ValueInstrument label={t('vital.radialPulse')} value={pulseText} />
        </dl>
      ) : (
        /* 実測モードの計測器は操作であり定義ではない。真の値は上の sr-only が担う */
        <div className="grid grid-cols-3 gap-1">
          <BreathInstrument onChange={onBreathCounted} />
          <CrtInstrument case={c} onMeasured={onCrtMeasured} measured={measuredCrt} />
          <PulseInstrument case={c} onCounted={onPulseCounted} />
        </div>
      )}
    </div>
  );
}

/** 数値モードのセル。計測器と同じ枠・同じ高さに数値だけを入れる */
function ValueInstrument({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col bg-slate-800">
      <dt className="truncate px-1.5 pt-1 text-[10px] leading-none text-slate-400">{label}</dt>
      <dd className="flex h-14 items-center justify-center px-1 text-center">
        <span className="font-mono text-base font-semibold tabular-nums">{value}</span>
      </dd>
      {/* 計測器と高さを揃える。モードを切り替えても配置が動かない */}
      <div className="h-7" />
      <div className="h-13 p-1" />
    </div>
  );
}

/** 実測モードで胸郭を動かすべきか（無呼吸は動かさない。静止が手がかり） */
export function shouldAnimateChest(c: TriageCase, presentation: RrPresentation): boolean {
  return presentation === 'observed' && breathingPatternOf(c) !== 'apneic';
}
