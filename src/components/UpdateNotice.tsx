import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { applyUpdate, onUpdateAvailable } from '@/lib/pwa';

/**
 * 新しい版が用意できたことの通知（SPEC §4.5）。
 *
 * **自動では切り替えない。** 10問チャレンジの最中に再読み込みされると
 * 計測中の記録が失われる。切り替えは利用者が選ぶ。
 *
 * 画面下部に重ねるが、回答ボタンを覆わないよう最下段より上に出す。
 */
export function UpdateNotice() {
  const { t } = useI18n();
  const [available, setAvailable] = useState(false);

  useEffect(() => onUpdateAvailable(setAvailable), []);

  if (!available) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-2"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 border border-slate-600 bg-slate-800 px-3 py-2 shadow-lg">
        <p className="min-w-0 flex-1 text-xs leading-tight text-slate-200">{t('pwa.updateAvailable')}</p>
        <button
          type="button"
          onClick={applyUpdate}
          className="min-h-9 shrink-0 bg-sky-600 px-3 text-xs font-semibold text-white transition active:scale-95"
        >
          {t('pwa.update')}
        </button>
        <button
          type="button"
          onClick={() => setAvailable(false)}
          aria-label={t('settings.close')}
          className="min-h-9 shrink-0 px-2 text-sm text-slate-400 transition active:scale-95"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </div>
  );
}
