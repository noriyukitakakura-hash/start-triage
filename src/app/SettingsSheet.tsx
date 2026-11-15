import { useState } from 'react';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { RrPresentationSwitch } from '@/components/RrPresentationSwitch';
import { Sheet } from '@/components/Sheet';
import { useSettings } from '@/app/SettingsProvider';
import { useI18n } from '@/i18n';
import { accuracyPercent } from '@/lib/format';
import { loadState, resetLearnStats } from '@/lib/storage';

/**
 * 設定シート（S6 の先行実装）。
 *
 * 出題画面をスクロールなしに収めるため、常時表示する必要のない操作をここへ集約する
 * （SPEC §5.1）。既存のコンポーネントをそのまま再利用している。
 */
export interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenDisclaimer: () => void;
}

export function SettingsSheet({ open, onClose, onOpenDisclaimer }: SettingsSheetProps) {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettings();
  const [cleared, setCleared] = useState(false);
  // 開くたびに最新の統計を読む
  const stats = open && !cleared ? loadState().learnStats : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('settings.heading')}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 w-full rounded-xl bg-slate-100 text-base font-semibold text-slate-900 transition active:scale-95"
        >
          {t('settings.close')}
        </button>
      }
    >
      <div className="space-y-3">
        <RrPresentationSwitch />

        <Toggle
          label={t('settings.suddenDeath')}
          description={t('settings.suddenDeath.description')}
          value={settings.suddenDeath}
          onChange={(suddenDeath) => updateSettings({ suddenDeath })}
        />

        <Toggle
          label={t('settings.showTimer')}
          description={t('settings.showTimer.description')}
          value={settings.showTimer}
          onChange={(showTimer) => updateSettings({ showTimer })}
        />

        <fieldset className="rounded-lg border border-slate-700 p-2">
          <legend className="px-1 text-xs text-slate-400">{t('settings.boundaryRate')}</legend>
          <div className="flex items-center gap-2 px-1">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.boundaryRate * 100)}
              onChange={(e) => updateSettings({ boundaryRate: Number(e.target.value) / 100 })}
              className="flex-1"
              aria-label={t('settings.boundaryRate')}
            />
            <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums">
              {Math.round(settings.boundaryRate * 100)}%
            </span>
          </div>
          <p className="px-1 text-[11px] leading-tight text-slate-500">
            {t('settings.boundaryRate.description')}
          </p>
        </fieldset>

        <fieldset className="rounded-lg border border-slate-700 p-2">
          <legend className="px-1 text-xs text-slate-400">{t('locale.label')}</legend>
          <LocaleSwitch />
        </fieldset>

        {stats !== null && stats.answered > 0 && (
          <div className="rounded-lg border border-slate-700 p-2">
            <p className="px-1 text-xs text-slate-400">{t('settings.stats')}</p>
            <p className="px-1 text-sm">
              {t('learn.totalStats', {
                answered: stats.answered,
                correct: stats.correct,
                accuracy: accuracyPercent(stats.correct, stats.answered),
              })}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenDisclaimer}
          className="min-h-11 w-full rounded-lg border border-slate-600 px-3 text-left text-sm text-slate-200 transition active:scale-95"
        >
          {t('settings.disclaimer')}
        </button>

        <button
          type="button"
          onClick={() => {
            resetLearnStats();
            setCleared(true);
          }}
          disabled={cleared || stats === null || stats.answered === 0}
          className="min-h-11 w-full rounded-lg border border-slate-600 px-3 text-left text-sm text-slate-400 transition active:scale-95 disabled:opacity-45"
        >
          {cleared ? t('settings.resetStats.done') : t('settings.resetStats')}
        </button>
      </div>
    </Sheet>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 p-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] leading-tight text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={[
          'min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition active:scale-95',
          value ? 'bg-sky-600 text-white' : 'border border-slate-600 text-slate-300',
        ].join(' ')}
      >
        {t(value ? 'settings.on' : 'settings.off')}
      </button>
    </div>
  );
}
