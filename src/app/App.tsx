import { useCallback, useState } from 'react';
import { LearnMode } from '@/features/learn/LearnMode';
import { useI18n } from '@/i18n';
import { acknowledgeDisclaimer, hasAcknowledgedDisclaimer } from '@/lib/storage';
import { DisclaimerDialog } from './DisclaimerDialog';
import { SettingsSheet } from './SettingsSheet';

/**
 * アプリのシェル（SPEC §5.1）。
 *
 * **ページ本体は絶対にスクロールさせない。** `h-dvh` の 3 行グリッドに固定し、
 * ヘッダーと回答バーを常に画面内へ留める。中央の症例ペインだけが可変で、
 * `min-h-0` によって内容量でグリッドが押し広げられるのを防いでいる。
 *
 * 常時表示が不要な操作（言語・提示方式・免責）は設定シートへ集約し、
 * 出題画面の高さを判定材料のために空けている。
 */
export function App() {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 初回のみ免責の確認を求める。確認済みなら出さない
  const [needsAcknowledgement, setNeedsAcknowledgement] = useState(() => !hasAcknowledgedDisclaimer());
  const [disclaimerOpen, setDisclaimerOpen] = useState(() => !hasAcknowledgedDisclaimer());

  const acknowledge = useCallback(() => {
    acknowledgeDisclaimer();
    setNeedsAcknowledgement(false);
    setDisclaimerOpen(false);
  }, []);

  const openDisclaimer = useCallback(() => {
    setSettingsOpen(false);
    setDisclaimerOpen(true);
  }, []);

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-slate-900 text-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 px-3 py-1.5">
        <h1 className="truncate text-sm font-bold">{t('app.titleShort')}</h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t('settings.open')}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xl text-slate-300 transition active:scale-95"
        >
          <span aria-hidden>⚙</span>
        </button>
      </header>

      {/* コンテナクエリの基準。全幅・グリッド行の高さを持つ */}
      <div className="case-pane min-h-0">
        <main className="case-main mx-auto flex h-full w-full flex-col px-3 pb-2 pt-2">
          <LearnMode />
        </main>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenDisclaimer={openDisclaimer}
      />
      <DisclaimerDialog
        open={disclaimerOpen}
        requireAcknowledgement={needsAcknowledgement}
        onAcknowledge={acknowledge}
        onClose={() => setDisclaimerOpen(false)}
      />
    </div>
  );
}
