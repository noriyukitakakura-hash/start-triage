import { JP_FDMA } from '@/domain/profiles';
import { CATEGORIES, DECIDING_STEPS } from '@/domain/types';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';

/**
 * START法リファレンス（SPEC §2.1 / S5）。
 *
 * **採用している基準値を明示する。** START法の基準は国・組織で異なるため、
 * 何に基づいて採点しているかを利用者が確認できなければならない（SPEC §1.7）。
 * 英語UIでも同じ内容を示す（docs/I18N.md §2）。
 */
const CATEGORY_STYLE: Record<string, string> = {
  I: 'bg-red-600 text-white',
  II: 'bg-amber-400 text-slate-900',
  III: 'bg-green-600 text-white',
  '0': 'bg-slate-950 text-white border border-slate-500',
};

export function ReferenceScreen() {
  const { t } = useI18n();

  return (
    <section
      aria-label={t('reference.heading')}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2"
    >
      <div>
        <h2 className="mb-1 text-sm font-bold text-slate-300">{t('reference.flow')}</h2>
        <ol className="space-y-1">
          {DECIDING_STEPS.map((step, index) => (
            <li key={step} className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5">
              <p className="text-xs font-semibold text-sky-300">
                {index + 1}. {t(`step.${step}` as TranslationKey)}
              </p>
              <p className="text-sm leading-tight">
                {t(`reference.flowStep.${step}` as TranslationKey)}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-bold text-slate-300">{t('reference.categories')}</h2>
        <dl className="space-y-1">
          {CATEGORIES.map((category) => (
            <div key={category} className="flex items-center gap-2">
              <dt
                className={[
                  'flex size-9 shrink-0 items-center justify-center rounded-md font-bold',
                  CATEGORY_STYLE[category] ?? '',
                ].join(' ')}
              >
                {t(`category.${category}.roman`)}
              </dt>
              <dd className="min-w-0 text-sm leading-tight">
                {t(`category.${category}.name`)}
                <span className="text-slate-400"> / {t(`category.${category}.color`)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-bold text-slate-300">{t('reference.criteria')}</h2>
        <ul className="space-y-1 text-sm leading-tight">
          <li className="rounded-lg bg-slate-800 px-2 py-1.5">
            {t('reference.criteria.rr', {
              low: JP_FDMA.respiratoryRateLowMax,
              high: JP_FDMA.respiratoryRateHighMin,
            })}
          </li>
          <li className="rounded-lg bg-slate-800 px-2 py-1.5">
            {t('reference.criteria.circulation', { crt: JP_FDMA.crtThresholdSeconds })}
          </li>
          <li className="rounded-lg bg-slate-800 px-2 py-1.5">
            {t('reference.criteria.consciousness')}
          </li>
        </ul>
        <p className="mt-1 text-[11px] leading-tight text-slate-400">{t('disclaimer.criteria')}</p>
      </div>
    </section>
  );
}
