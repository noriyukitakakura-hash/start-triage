import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';

/**
 * 開始前のカウントダウン（SPEC §2.4）。
 * 計測はカウントダウン終了後に始まるため、ここでの表示遅延は記録に影響しない。
 */
export function Countdown({ onDone, seconds = 3 }: { onDone: () => void; seconds?: number }) {
  const { t } = useI18n();
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onDone();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, onDone]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
      <p className="text-sm text-slate-400">{t('challenge.ready')}</p>
      <p aria-live="assertive" className="font-mono text-7xl font-bold tabular-nums">
        {remaining > 0 ? remaining : t('challenge.start')}
      </p>
    </div>
  );
}
