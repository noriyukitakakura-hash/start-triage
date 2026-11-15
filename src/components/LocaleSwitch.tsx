import { LOCALES, useI18n } from '@/i18n';

/** ヘッダの言語切替（docs/I18N.md §4）。即時切替・リロードなし */
export function LocaleSwitch() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div role="group" aria-label={t('locale.label')} className="inline-flex rounded-lg border border-slate-600 p-0.5">
      {LOCALES.map((candidate) => {
        const active = candidate === locale;
        return (
          <button
            key={candidate}
            type="button"
            lang={candidate}
            aria-pressed={active}
            onClick={() => setLocale(candidate)}
            className={[
              'min-w-20 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:bg-slate-700',
            ].join(' ')}
          >
            {t(candidate === 'ja' ? 'locale.ja' : 'locale.en')}
          </button>
        );
      })}
    </div>
  );
}
