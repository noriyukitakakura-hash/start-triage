import { FormattedDuration } from '@/components/Timer';
import { useI18n } from '@/i18n';
import { RR_PRESENTATIONS, loadState } from '@/lib/storage';
import type { Route } from '@/app/router';

/**
 * ホーム（SPEC §2.1 / S1）。
 * モード選択と自己ベストの確認が主な役目。
 */
export function HomeScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { t } = useI18n();
  const best = loadState().bestTimeMs;

  return (
    <section aria-label={t('nav.home')} className="flex min-h-0 flex-1 flex-col gap-2">
      <ModeButton
        label={t('nav.practice')}
        description={t('home.learn.description')}
        onClick={() => onNavigate('/learn')}
        primary
      />
      <ModeButton
        label={t('nav.challenge')}
        description={t('home.challenge.description')}
        onClick={() => onNavigate('/challenge')}
        primary
      />

      <div className="rounded-lg border border-slate-700 p-2">
        <p className="px-1 text-xs text-slate-400">{t('home.bestTime')}</p>
        <dl className="grid grid-cols-2 gap-1 px-1 pt-1">
          {RR_PRESENTATIONS.map((presentation) => (
            <div key={presentation}>
              <dt className="text-[11px] text-slate-400">{t(`home.bestTime.${presentation}`)}</dt>
              <dd className="font-mono text-sm tabular-nums">
                {best[presentation] === null ? (
                  <span className="text-slate-400">{t('home.noBestTime')}</span>
                ) : (
                  <FormattedDuration ms={best[presentation]} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <ModeButton
        label={t('nav.reference')}
        description={t('home.reference.description')}
        onClick={() => onNavigate('/reference')}
      />
    </section>
  );
}

function ModeButton({
  label,
  description,
  onClick,
  primary = false,
}: {
  label: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full shrink-0 rounded-xl px-3 py-3 text-left transition active:scale-95',
        primary ? 'bg-sky-700 text-white' : 'border border-slate-600 text-slate-200',
      ].join(' ')}
    >
      <span className="block text-base font-bold">{label}</span>
      <span className={['block text-xs', primary ? 'text-sky-100' : 'text-slate-400'].join(' ')}>
        {description}
      </span>
    </button>
  );
}
