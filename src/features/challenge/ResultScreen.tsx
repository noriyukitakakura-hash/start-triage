import { useState } from 'react';
import { explain } from '@/domain/explain';
import { JP_FDMA } from '@/domain/profiles';
import { FlowChartCompact } from '@/components/FlowChart';
import { FormattedDuration } from '@/components/Timer';
import { Sheet } from '@/components/Sheet';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';
import { formatDurationParts } from '@/lib/format';
import { currentOrigin, openShare, shareModeKey } from '@/lib/share';
import { loadState } from '@/lib/storage';
import type { AnsweredCase } from './useChallenge';
import type { RrPresentation } from '@/lib/storage';

/**
 * 10問チャレンジの結果（SPEC §2.4 / S4）。
 *
 * **X への投稿は「実測モードで全問正解」のときだけ出す。**
 * - 全問正解に限るのは、達成の希少性が投稿の価値になるため
 * - 実測モードに限るのは、数値を読むだけの数値モードではタイムが短く、
 *   かつ現場で必要な「見て判断する」技能を示さないため。
 *   共有される記録は現場寄りの技能を表すものに揃える
 *
 * タイムはクライアント計測で改ざん可能なため、自己申告の共有に留める（SPEC §1.7）。
 */
export interface ResultScreenProps {
  answers: AnsweredCase[];
  total: number;
  correct: number;
  timeMs: number;
  endedEarly: boolean;
  newBest: boolean;
  presentation: RrPresentation;
  onRetry: () => void;
  onHome: () => void;
}

export function ResultScreen({
  answers,
  total,
  correct,
  timeMs,
  endedEarly,
  newBest,
  presentation,
  onRetry,
  onHome,
}: ResultScreenProps) {
  const { t, locale } = useI18n();
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  const perfect = correct === total;
  // 投稿は実測モードの全問正解に限る
  const canShare = perfect && presentation === 'observed';
  const best = loadState().bestTimeMs[presentation];
  const reviewed = reviewIndex === null ? null : (answers[reviewIndex] ?? null);

  const share = () => {
    const { minutes, seconds } = formatDurationParts(timeMs);
    const time =
      minutes > 0
        ? t('format.durationWithMinutes', { minutes, seconds })
        : t('format.durationSeconds', { seconds });

    openShare({
      text: t(newBest ? 'share.textWithBest' : 'share.text', {
        time,
        mode: t(shareModeKey(presentation)),
      }),
      hashtags: t('share.hashtags'),
      locale,
      origin: currentOrigin(),
    });
  };

  return (
    <section aria-label={t('result.heading')} className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        className={[
          'shrink-0 rounded-lg px-3 py-2 text-center',
          perfect ? 'bg-green-700' : 'bg-slate-800',
        ].join(' ')}
      >
        <p className="text-lg font-bold">{t('result.score', { correct, total })}</p>
        <p className="font-mono text-2xl font-bold tabular-nums">
          <FormattedDuration ms={timeMs} />
        </p>
        {perfect && <p className="text-sm">{t('result.perfect')}</p>}
        {newBest && <p className="text-sm font-semibold text-amber-200">★ {t('result.newBest')}</p>}
        {endedEarly && <p className="text-sm text-amber-200">{t('result.suddenDeathEnded')}</p>}
      </div>

      {/* 各問の正誤。タップで解説を開く */}
      <div className="min-h-0 flex-1">
        <p className="mb-1 text-center text-[11px] text-slate-400">{t('result.reviewHint')}</p>
        <ol className="grid grid-cols-5 gap-1">
          {answers.map((a, index) => (
            <li key={a.item.case.id}>
              <button
                type="button"
                onClick={() => setReviewIndex(index)}
                className={[
                  'flex w-full flex-col items-center rounded-md border px-1 py-1.5',
                  a.correct
                    ? 'border-green-500 bg-green-900/40 text-green-200'
                    : 'border-red-500 bg-red-900/40 text-red-200',
                ].join(' ')}
              >
                <span className="text-[10px] leading-none text-slate-400">{index + 1}</span>
                <span aria-hidden className="text-base leading-tight">
                  {a.correct ? '○' : '×'}
                </span>
                <span className="sr-only">{t(a.correct ? 'learn.correct' : 'learn.incorrect')}</span>
                <span className="text-[10px] leading-none">
                  {t(`category.${a.expected}.roman`)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="shrink-0 space-y-1.5">
        {canShare ? (
          <button
            type="button"
            onClick={share}
            className="min-h-12 w-full rounded-xl bg-slate-100 text-sm font-bold text-slate-900 transition active:scale-95"
          >
            {t('result.share')}
          </button>
        ) : (
          <p className="text-center text-[11px] text-slate-400">{t('result.shareHint')}</p>
        )}

        <p className="text-center text-[11px] text-slate-400">
          {t(`result.mode.${presentation}`)}
          {best !== null && (
            <>
              {' · '}
              {t('result.bestSoFar', { time: '' })}
              <FormattedDuration ms={best} />
            </>
          )}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onHome}
            className="min-h-12 flex-1 rounded-xl border border-slate-600 text-sm text-slate-200 transition active:scale-95"
          >
            {t('result.backHome')}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-12 flex-1 rounded-xl bg-sky-700 text-sm font-semibold text-white transition active:scale-95"
          >
            {t('result.retry')}
          </button>
        </div>
      </div>

      {reviewed !== null && (
        <Sheet
          open
          onClose={() => setReviewIndex(null)}
          title={t('result.heading')}
          footer={
            <button
              type="button"
              onClick={() => setReviewIndex(null)}
              className="min-h-12 w-full rounded-xl bg-slate-100 text-base font-semibold text-slate-900 transition active:scale-95"
            >
              {t('settings.close')}
            </button>
          }
        >
          <ReviewBody answer={reviewed} />
        </Sheet>
      )}
    </section>
  );
}

function ReviewBody({ answer }: { answer: AnsweredCase }) {
  const { t } = useI18n();
  const explanation = explain(answer.item.case, JP_FDMA);
  const decided = explanation.steps.find((s) => s.status === 'decided');

  return (
    <div className="space-y-2">
      <p className="text-sm">
        {t('learn.yourAnswer')}: {t(`category.${answer.answered}.name`)}
        {!answer.correct && (
          <>
            {' / '}
            {t('learn.expectedAnswer')}: {t(`category.${answer.expected}.name`)}
          </>
        )}
      </p>
      <FlowChartCompact explanation={explanation} />
      {decided !== undefined &&
        decided.details.map((detail) => (
          <p key={detail.key} className="text-sm">
            {t(detail.key as TranslationKey, detail.params)}
          </p>
        ))}
    </div>
  );
}
