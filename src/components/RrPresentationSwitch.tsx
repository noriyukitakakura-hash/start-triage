import { useSettings } from '@/app/SettingsProvider';
import { useI18n } from '@/i18n';
import { RR_PRESENTATIONS } from '@/lib/storage';

/**
 * 呼吸数の提示方式の切替（SPEC §2.2 / docs/OBSERVATION.md §2）。
 *
 * 2つのモードは異なる技能を訓練する。どちらが上位ということはないため、
 * 説明文を併記して利用者が目的に応じて選べるようにする。
 */
export function RrPresentationSwitch() {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettings();

  return (
    <fieldset className="rounded-lg border border-slate-700 p-2">
      <legend className="px-1 text-xs text-slate-400">{t('settings.vitalsPresentation')}</legend>
      <div className="flex gap-2">
        {RR_PRESENTATIONS.map((presentation) => {
          const active = settings.vitalsPresentation === presentation;
          return (
            <button
              key={presentation}
              type="button"
              aria-pressed={active}
              onClick={() => updateSettings({ vitalsPresentation: presentation })}
              className={[
                'flex-1 rounded-md px-3 py-1.5 text-left transition',
                active ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:bg-slate-700',
              ].join(' ')}
            >
              <span className="block text-sm font-semibold">
                {t(`settings.vitalsPresentation.${presentation}`)}
              </span>
              <span className={['block text-xs', active ? 'text-slate-600' : 'text-slate-500'].join(' ')}>
                {t(`settings.vitalsPresentation.${presentation}.description`)}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
