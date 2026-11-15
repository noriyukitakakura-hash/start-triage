import { LocaleSwitch } from '@/components/LocaleSwitch';
import { RrPresentationSwitch } from '@/components/RrPresentationSwitch';
import { Sheet } from '@/components/Sheet';
import { useI18n } from '@/i18n';
import { accuracyPercent } from '@/lib/format';
import { loadState } from '@/lib/storage';

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
  // 開くたびに最新の統計を読む
  const stats = open ? loadState().learnStats : null;

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
      </div>
    </Sheet>
  );
}
