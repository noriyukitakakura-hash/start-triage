import { useState } from 'react';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { PatientFigure } from '@/components/patients';
import { ILLUSTRATIONS } from '@/domain/illustrations';
import { useI18n } from '@/i18n';
import type { TriageCase } from '@/domain/types';

/** P2 の目視確認用。13種のイラストと呼吸アニメーションを一覧する */
function FigureGallery() {
  const { t } = useI18n();
  const [rr, setRr] = useState(18);
  const [apneic, setApneic] = useState(false);

  const caseFor = (illustrationId: string, situationKey: string, canWalk: boolean): TriageCase => ({
    id: illustrationId,
    patient: { illustrationId, situationKey },
    canWalk,
    hasSpontaneousBreathing: !apneic,
    breathingAfterAirway: apneic ? false : null,
    respiratoryRate: apneic ? 0 : rr,
    radialPulsePalpable: true,
    pulseRate: 88,
    crtSeconds: 1.2,
    obeysCommands: !apneic,
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-800 p-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="w-28">呼吸数 {apneic ? '—' : `${rr} 回/分`}</span>
          <input
            type="range"
            min={4}
            max={44}
            value={rr}
            disabled={apneic}
            onChange={(e) => setRr(Number(e.target.value))}
            className="w-48"
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={apneic} onChange={(e) => setApneic(e.target.checked)} />
          <span>自発呼吸なし（静止）</span>
        </label>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ILLUSTRATIONS.map((i) => (
          <li key={i.id} className="rounded-lg border border-slate-700 bg-slate-800 p-2">
            <PatientFigure
              case={caseFor(i.id, i.situationKey, i.canWalk)}
              animate
              className="w-full text-slate-200"
            />
            <p className="mt-1 text-center text-xs text-slate-400">{i.id}</p>
            <p className="text-center text-xs text-slate-500">{t(`situation.${i.situationKey.split('.')[1]}` as never)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

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

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <p className="rounded-lg bg-slate-800 p-3 text-sm">{t('dev.scaffoldReady', { locale })}</p>

        <FigureGallery />

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
