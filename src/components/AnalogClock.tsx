import { useI18n } from '@/i18n';
import { formatDurationParts } from '@/lib/format';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

/**
 * 経過時間のアナログ表示（SPEC §2.4）。
 *
 * 10問チャレンジ中に使う。**経過**時間なので針は回り続ける。
 * 秒針が一周する速さで、数字を読まなくてもおおよその経過が掴める。
 *
 * - 視覚のみに依存しないよう、数値を `sr-only` で併記する（SPEC §5.3）
 * - `prefers-reduced-motion` では針を動かさず数値表示へフォールバックする
 */
export interface AnalogClockProps {
  elapsedMs: number;
  className?: string | undefined;
}

const SIZE = 48;
const CENTER = SIZE / 2;

export function AnalogClock({ elapsedMs, className }: AnalogClockProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { minutes, seconds } = formatDurationParts(elapsedMs);

  const label =
    minutes > 0
      ? t('format.durationWithMinutes', { minutes, seconds })
      : t('format.durationSeconds', { seconds });

  if (prefersReducedMotion) {
    return (
      <output aria-label={t('clock.elapsed')} className={['font-mono tabular-nums', className].filter(Boolean).join(' ')}>
        {label}
      </output>
    );
  }

  const totalSeconds = Math.max(0, elapsedMs) / 1000;
  const secondAngle = (totalSeconds % 60) * 6;
  // 分針は連続して進める。カクつかせないことで経過の実感が途切れない
  const minuteAngle = ((totalSeconds / 60) % 60) * 6;

  return (
    <output aria-label={t('clock.elapsed')} className={className}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden focusable="false">
        <circle cx={CENTER} cy={CENTER} r={CENTER - 1.5} className="fill-slate-800 stroke-slate-600" strokeWidth={1.5} />
        {/* 12・3・6・9 の目盛り。文字を置かずに向きが分かるようにする */}
        {[0, 90, 180, 270].map((angle) => (
          <line
            key={angle}
            x1={CENTER}
            y1={4}
            x2={CENTER}
            y2={7.5}
            transform={`rotate(${angle} ${CENTER} ${CENTER})`}
            className="stroke-slate-500"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ))}
        <line
          x1={CENTER}
          y1={CENTER}
          x2={CENTER}
          y2={CENTER - 11}
          transform={`rotate(${minuteAngle} ${CENTER} ${CENTER})`}
          className="stroke-slate-100"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <line
          x1={CENTER}
          y1={CENTER + 3}
          x2={CENTER}
          y2={CENTER - 16}
          transform={`rotate(${secondAngle} ${CENTER} ${CENTER})`}
          className="stroke-sky-400"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <circle cx={CENTER} cy={CENTER} r={2} className="fill-sky-400" />
      </svg>
      <span className="sr-only">{label}</span>
    </output>
  );
}
