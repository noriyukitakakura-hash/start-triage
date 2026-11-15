import { useCallback, useEffect, useMemo, useState } from 'react';
import { explain } from '@/domain/explain';
import { generateCase, type GeneratedCase } from '@/domain/generator';
import { judge } from '@/domain/judge';
import { JP_FDMA } from '@/domain/profiles';
import { createRng, type Rng } from '@/domain/rng';
import type { Category } from '@/domain/types';
import { CaseCard } from '@/components/CaseCard';
import { CATEGORY_KEYS, CategoryButtons } from '@/components/CategoryButtons';
import { EMPTY_COUNT, type CountResult } from '@/components/BreathCounter';
import { useI18n } from '@/i18n';
import { recordLearnAnswer, rrMarginFor } from '@/lib/storage';
import { useSettings } from '@/app/SettingsProvider';
import { FeedbackSheet } from './FeedbackSheet';

/**
 * 学習モード（SPEC §2.2, §2.3 / S2）。
 *
 * 出題 → 回答 → 即時フィードバック → 次へ を無制限に繰り返す。
 * **画面はスクロールさせない。** 解説はボトムシートで出し、背後に症例を残す。
 */

/**
 * 出題する区分の重み。I類は判定経路が4通りあるため厚めに出す。
 * 10問モードの固定構成（SPEC §2.4）とは別に、学習向けの配分とする。
 */
const LEARN_WEIGHTS: readonly Category[] = ['I', 'I', 'I', 'I', 'II', 'II', 'III', 'III', '0', '0'];

export function LearnMode() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const profile = JP_FDMA;

  // セッション中は同じ乱数列を使う。初期化関数は一度しか走らないため乱数列が安定する
  const [rng] = useState<Rng>(() =>
    createRng(`learn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`),
  );

  const rrMargin = rrMarginFor(settings.rrPresentation);

  const nextCase = useCallback(
    (): GeneratedCase => generateCase({ target: rng.pick(LEARN_WEIGHTS), rrMargin, profile }, rng),
    [rng, rrMargin, profile],
  );

  const [item, setItem] = useState<GeneratedCase>(() => nextCase());
  const [answer, setAnswer] = useState<Category | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [count, setCount] = useState<CountResult>(EMPTY_COUNT);

  const judgement = useMemo(() => judge(item.case, profile), [item, profile]);
  const explanation = useMemo(() => explain(item.case, profile), [item, profile]);

  const handleAnswer = useCallback(
    (category: Category) => {
      if (answer !== null) return;
      setAnswer(category);
      setSheetOpen(true);
      recordLearnAnswer(judgement.category, category);
    },
    [answer, judgement.category],
  );

  const handleNext = useCallback(() => {
    setSheetOpen(false);
    setItem(nextCase());
    setAnswer(null);
    setCount(EMPTY_COUNT);
  }, [nextCase]);

  // キーボードショートカット（SPEC §5.2）。回答後はシートが受け持つ
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (answer !== null) return;

      const category = CATEGORY_KEYS[event.key];
      if (category !== undefined) {
        event.preventDefault();
        handleAnswer(category);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answer, handleAnswer]);

  const answered = answer !== null;

  return (
    <section aria-label={t('learn.heading')} className="flex min-h-0 flex-1 flex-col gap-2">
      {/* 症例の key で計数 UI を確実にリセットする */}
      <CaseCard
        key={item.case.id}
        case={item.case}
        presentation={settings.rrPresentation}
        onCountChange={setCount}
      />

      <div className="shrink-0">
        {answered ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="min-h-14 flex-1 rounded-xl border border-slate-600 text-sm font-medium text-slate-200 transition active:scale-95"
            >
              {t('feedback.showExplanation')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="min-h-14 flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-900 transition active:scale-95"
            >
              {t('learn.next')}
            </button>
          </div>
        ) : (
          <CategoryButtons onAnswer={handleAnswer} />
        )}
      </div>

      {answered && (
        <FeedbackSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onNext={handleNext}
          case={item.case}
          explanation={explanation}
          answer={answer}
          expected={judgement.category}
          count={count}
          profile={profile}
          showCountFeedback={settings.rrPresentation === 'observed'}
        />
      )}
    </section>
  );
}
