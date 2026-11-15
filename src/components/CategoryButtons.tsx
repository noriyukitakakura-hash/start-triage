import { CATEGORIES, type Category } from '@/domain/types';
import { useI18n } from '@/i18n';

/**
 * トリアージ区分の回答ボタン（SPEC §2.2, §5.2, §5.3）。
 *
 * **色のみに依存しない。** 色・ローマ数字・和文ラベル・枠線パターンの4重符号化。
 * 親指到達域に置けるよう、呼び出し側が下部に固定配置する。
 */

/** キーボードショートカット（SPEC §5.2） */
export const CATEGORY_KEYS: Readonly<Record<string, Category>> = {
  '1': 'I',
  '2': 'II',
  '3': 'III',
  '0': '0',
};

const STYLES: Record<Category, string> = {
  I: 'bg-red-600 text-white border-red-300',
  II: 'bg-amber-400 text-slate-900 border-amber-200',
  III: 'bg-green-600 text-white border-green-300',
  '0': 'bg-slate-950 text-white border-slate-400',
};

/** 色覚に依存しないための枠線パターン */
const BORDERS: Record<Category, string> = {
  I: 'border-solid border-4',
  II: 'border-dashed border-4',
  III: 'border-dotted border-4',
  '0': 'border-double border-[6px]',
};

export interface CategoryButtonsProps {
  onAnswer: (category: Category) => void;
  disabled?: boolean;
  /** 回答済みの場合、選んだ区分と正解を示す */
  selected?: Category | null;
  expected?: Category | null;
}

export function CategoryButtons({ onAnswer, disabled = false, selected = null, expected = null }: CategoryButtonsProps) {
  const { t } = useI18n();

  return (
    <div role="group" aria-label={t('learn.selectCategory')} className="grid grid-cols-4 gap-2">
      {CATEGORIES.map((category) => {
        const isSelected = selected === category;
        const isExpected = expected === category;
        return (
          <button
            key={category}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(category)}
            aria-label={t(`category.${category}.name`)}
            className={[
              'flex min-h-20 flex-col items-center justify-center rounded-xl px-1 py-2 transition',
              STYLES[category],
              BORDERS[category],
              disabled ? 'opacity-45' : 'active:scale-95',
              isSelected ? 'ring-4 ring-sky-300 ring-offset-2 ring-offset-slate-900 opacity-100' : '',
              isExpected && !isSelected ? 'ring-4 ring-white ring-offset-2 ring-offset-slate-900 opacity-100' : '',
            ].join(' ')}
          >
            <span aria-hidden className="text-2xl font-bold leading-none">
              {t(`category.${category}.roman`)}
            </span>
            <span aria-hidden className="mt-1 text-xs font-medium leading-tight">
              {t(`category.${category}.short`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
