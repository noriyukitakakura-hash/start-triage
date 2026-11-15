import { useCallback, useEffect } from 'react';
import { CaseCard } from '@/components/CaseCard';
import { CATEGORY_KEYS, CategoryButtons } from '@/components/CategoryButtons';
import { Timer } from '@/components/Timer';
import { useSettings } from '@/app/SettingsProvider';
import { useI18n } from '@/i18n';
import { Countdown } from './Countdown';
import { ResultScreen } from './ResultScreen';
import { useChallenge } from './useChallenge';

/**
 * 10問チャレンジ（SPEC §2.4 / S3）。
 *
 * **出題中はフィードバックを一切出さない。** 正誤を伏せることで、
 * 1問ごとの迷いが次の判断に持ち越されないようにする。
 */
export function ChallengeMode({ onHome }: { onHome: () => void }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const challenge = useChallenge(settings);

  const { phase, answer } = challenge;

  // キーボードショートカット（SPEC §5.2）
  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (phase !== 'playing') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const category = CATEGORY_KEYS[event.key];
      if (category !== undefined) {
        event.preventDefault();
        answer(category);
      }
    },
    [phase, answer],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (phase === 'countdown') {
    return <Countdown onDone={challenge.begin} />;
  }

  if (phase === 'finished') {
    return (
      <ResultScreen
        answers={challenge.answers}
        total={challenge.total}
        correct={challenge.correct}
        timeMs={challenge.timeMs ?? 0}
        endedEarly={challenge.endedEarly}
        newBest={challenge.newBest}
        presentation={challenge.presentation}
        onRetry={challenge.restart}
        onHome={onHome}
      />
    );
  }

  const current = challenge.current;
  if (current === null) return null;

  return (
    <section aria-label={t('challenge.heading')} className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between text-xs text-slate-400">
        <span className="font-mono tabular-nums">
          {t('challenge.progress', { current: challenge.index + 1, total: challenge.total })}
        </span>
        {settings.showTimer && <Timer startedAt={challenge.startedAt} />}
      </div>

      {/* 症例の key で計数UIと気道確保の状態を確実にリセットする */}
      <CaseCard key={current.case.id} case={current.case} presentation={settings.rrPresentation} />

      <div className="shrink-0">
        <CategoryButtons onAnswer={answer} />
      </div>
    </section>
  );
}
