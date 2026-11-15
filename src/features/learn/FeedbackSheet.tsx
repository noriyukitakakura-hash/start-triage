import type { Explanation } from '@/domain/explain';
import type { Category, RuleProfile, TriageCase } from '@/domain/types';
import { breathingPatternOf } from '@/domain/breathing';
import type { CountResult } from '@/components/BreathCounter';
import { FlowChartCompact } from '@/components/FlowChart';
import { Sheet } from '@/components/Sheet';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';
import { CountFeedback } from './CountFeedback';

/**
 * 回答後の解説（SPEC §2.3, §5.1）。
 *
 * ボトムシートで出すことで**ページ本体を動かさず**、背後に症例が見え続ける。
 * 解説が長い場合もシート内部だけがスクロールする。
 */
export interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
  onNext: () => void;
  case: TriageCase;
  explanation: Explanation;
  answer: Category;
  expected: Category;
  count: CountResult;
  profile: RuleProfile;
  showCountFeedback: boolean;
}

export function FeedbackSheet({
  open,
  onClose,
  onNext,
  case: c,
  explanation,
  answer,
  expected,
  count,
  profile,
  showCountFeedback,
}: FeedbackSheetProps) {
  const { t } = useI18n();
  const isCorrect = answer === expected;
  const isAgonal = breathingPatternOf(c) === 'agonal';

  // 確定したステップの観察内容だけを本文で示す。通過分はチップの記号で足りる
  const decided = explanation.steps.find((s) => s.status === 'decided');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('feedback.heading')}
      hideTitle
      footer={
        <button
          type="button"
          onClick={onNext}
          className="min-h-12 w-full rounded-xl bg-slate-100 text-base font-semibold text-slate-900 transition active:scale-95"
        >
          {t('learn.next')}
        </button>
      }
    >
      <div className="space-y-2">
        <div
          className={[
            'rounded-lg px-3 py-2 text-center font-bold',
            isCorrect ? 'bg-green-700 text-white' : 'bg-red-700 text-white',
          ].join(' ')}
        >
          <span className="text-lg">{isCorrect ? `○ ${t('learn.correct')}` : `× ${t('learn.incorrect')}`}</span>
          {!isCorrect && (
            <p className="mt-0.5 text-sm font-normal">
              {t('learn.expectedAnswer')}: {t(`category.${expected}.name`)}
            </p>
          )}
        </div>

        <FlowChartCompact explanation={explanation} />

        {decided !== undefined && (
          <div className="space-y-0.5 text-sm">
            {decided.details.map((detail) => (
              <p key={detail.key}>{t(detail.key as TranslationKey, detail.params)}</p>
            ))}
            <p className="text-slate-400">{t('explain.conclusion')}</p>
          </div>
        )}

        {isAgonal && (
          <p className="rounded-md bg-slate-700 px-2 py-1 text-xs text-amber-200">
            {t('explain.agonalNote', { threshold: profile.respiratoryRateLowMax })}
          </p>
        )}

        {showCountFeedback && <CountFeedback case={c} count={count} profile={profile} />}
      </div>
    </Sheet>
  );
}
