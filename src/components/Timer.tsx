import { useEffect, useState } from 'react';
import { AnalogClock } from '@/components/AnalogClock';
import { useI18n } from '@/i18n';
import { formatDurationParts } from '@/lib/format';

/**
 * 経過時間の表示（SPEC §2.4, §4.5）。
 *
 * **計測と表示を分離する。** 計測は `performance.now()` の差分で行い、
 * 表示だけを 100ms 間隔で更新する。描画頻度が計測精度に影響しないようにするため。
 */
export interface TimerProps {
  /** `performance.now()` 基準の開始時刻。null の間は停止表示 */
  startedAt: number | null;
  /** 確定した経過時間。与えられたら計測を止めてこの値を表示する */
  frozenMs?: number | null;
  /** アナログ時計で表示する。10問チャレンジ中に使う（SPEC §2.4） */
  analog?: boolean;
  className?: string;
}

const TICK_MS = 100;

export function Timer({ startedAt, frozenMs = null, analog = false, className }: TimerProps) {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (startedAt === null || frozenMs !== null) return;
    const id = setInterval(() => setNow(performance.now()), TICK_MS);
    return () => clearInterval(id);
  }, [startedAt, frozenMs]);

  const elapsedMs = frozenMs ?? (startedAt === null ? 0 : Math.max(0, now - startedAt));

  if (analog) return <AnalogClock elapsedMs={elapsedMs} className={className} />;

  return (
    <output className={['font-mono tabular-nums', className].filter(Boolean).join(' ')}>
      <FormattedDuration ms={elapsedMs} />
    </output>
  );
}

/** 言語ごとの表記に整形する（ja: 1分23.45秒 / en: 1:23.45） */
export function FormattedDuration({ ms }: { ms: number }) {
  const { t } = useI18n();
  const { minutes, seconds } = formatDurationParts(ms);

  return (
    <>
      {minutes > 0
        ? t('format.durationWithMinutes', { minutes, seconds })
        : t('format.durationSeconds', { seconds })}
    </>
  );
}
