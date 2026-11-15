import type { Explanation } from '@/domain/explain';
import type { DecidingStep } from '@/domain/types';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';

/**
 * 判定フローの可視化（SPEC §2.3）。
 *
 * 5つの評価ステップを順序どおりに並べ、「通過」「ここで確定」「評価不要」を描き分ける。
 * START法の習熟は順序の体得が本質なので、**確定より後のステップが
 * 「評価不要だった」ことを明示する**のが重要。
 *
 * SVG図ではなく順序付きリストで実装している。日英で語長が大きく異なるため
 * SVG内の固定座標テキストでは破綻しやすく、スマートフォン縦持ちでの可読性と
 * スクリーンリーダーでの読み上げもリストの方が優れるため。
 */

const STATUS_KEY = {
  passed: 'explain.stepPassed',
  decided: 'explain.stepDecided',
  skipped: 'explain.stepSkipped',
} as const satisfies Record<string, TranslationKey>;

const STATUS_STYLE = {
  passed: 'border-slate-600 bg-slate-800 text-slate-300',
  decided: 'border-sky-400 bg-sky-950 text-sky-100',
  skipped: 'border-slate-800 bg-slate-900 text-slate-600',
} as const;

const BADGE_STYLE = {
  passed: 'bg-slate-700 text-slate-200',
  decided: 'bg-sky-500 text-slate-950',
  skipped: 'bg-slate-800 text-slate-500',
} as const;

function stepNameKey(step: DecidingStep): TranslationKey {
  return `step.${step}` as TranslationKey;
}

/** 状態を色以外でも示す記号（SPEC §5.3） */
const STATUS_MARK = {
  passed: '✓',
  decided: '★',
  skipped: '—',
} as const;

const CHIP_STYLE = {
  passed: 'border-slate-600 bg-slate-800 text-slate-300',
  decided: 'border-sky-400 bg-sky-500 text-slate-950 font-bold',
  skipped: 'border-slate-800 bg-slate-900 text-slate-600',
} as const;

/**
 * 横並び 5 チップのコンパクト表示。解説シートで使う（SPEC §5.1）。
 *
 * 全ステップの状態を一目で見せ、**確定より後が「評価不要」だったこと**を示す。
 * 観察内容の本文は呼び出し側が確定ステップ分だけ表示する。
 */
export function FlowChartCompact({ explanation }: { explanation: Explanation }) {
  const { t } = useI18n();

  return (
    <ol aria-label={t('explain.heading')} className="flex items-stretch gap-1">
      {explanation.steps.map((step) => (
        <li
          key={step.step}
          aria-current={step.status === 'decided' ? 'step' : undefined}
          className={[
            'min-w-0 flex-1 rounded-md border px-1 py-1 text-center',
            CHIP_STYLE[step.status],
          ].join(' ')}
        >
          <span className="block truncate text-[10px] leading-tight">{t(stepNameKey(step.step))}</span>
          <span className="block text-xs leading-tight">
            <span aria-hidden>{STATUS_MARK[step.status]}</span>
            <span className="sr-only">{t(STATUS_KEY[step.status])}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function FlowChart({ explanation }: { explanation: Explanation }) {
  const { t } = useI18n();

  return (
    <ol aria-label={t('explain.heading')} className="space-y-1.5">
      {explanation.steps.map((step) => (
        <li
          key={step.step}
          aria-current={step.status === 'decided' ? 'step' : undefined}
          className={['rounded-lg border px-3 py-2', STATUS_STYLE[step.status]].join(' ')}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t(stepNameKey(step.step))}</span>
            <span className={['rounded px-2 py-0.5 text-xs font-semibold', BADGE_STYLE[step.status]].join(' ')}>
              {t(STATUS_KEY[step.status])}
            </span>
          </div>
          {step.details.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {step.details.map((detail) => (
                <li key={detail.key} className="text-sm">
                  {t(detail.key as TranslationKey, detail.params)}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
