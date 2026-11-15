import { LocaleSwitch } from '@/components/LocaleSwitch';
import { useI18n } from '@/i18n';

export function App() {
  const { locale, t } = useI18n();

  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold">{t('app.title')}</h1>
          <p className="text-sm text-slate-400">{t('app.tagline')}</p>
        </div>
        <LocaleSwitch />
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <p className="rounded-lg bg-slate-800 p-3 text-sm">{t('dev.scaffoldReady', { locale })}</p>

        <section aria-label={t('nav.reference')} className="space-y-2">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['I', 'II', 'III', '0'] as const).map((code) => (
              <li
                key={code}
                className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-center"
              >
                <div className="text-2xl font-bold">{t(`category.${code}.roman`)}</div>
                <div className="text-sm">{t(`category.${code}.short`)}</div>
                <div className="text-xs text-slate-400">{t(`category.${code}.color`)}</div>
              </li>
            ))}
          </ul>
        </section>

        <footer className="space-y-2 border-t border-slate-700 pt-4 text-xs text-slate-400">
          <p>{t('disclaimer.training')}</p>
          <p>{t('disclaimer.criteria')}</p>
        </footer>
      </main>
    </div>
  );
}
