import { useCallback, useState } from 'react';
import { ChallengeMode } from '@/features/challenge/ChallengeMode';
import { HomeScreen } from '@/features/home/HomeScreen';
import { LearnMode } from '@/features/learn/LearnMode';
import { ReferenceScreen } from '@/features/reference/ReferenceScreen';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';
import { acknowledgeDisclaimer, hasAcknowledgedDisclaimer, hasSeenMeasureGuide, markMeasureGuideSeen } from '@/lib/storage';
import { ManualSheet } from '@/features/reference/ManualSheet';
import { useSettings } from './SettingsProvider';
import { DisclaimerDialog } from './DisclaimerDialog';
import { SettingsSheet } from './SettingsSheet';
import { UpdateNotice } from '@/components/UpdateNotice';
import { useNavigate, useRoute, type Route } from './router';

const SCREEN_TITLE: Record<Route, TranslationKey> = {
  '/': 'app.titleShort',
  '/learn': 'nav.practice',
  '/challenge': 'challenge.heading',
  '/reference': 'reference.heading',
};

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
  const route = useRoute();
  const navigate = useNavigate();
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

  const { settings } = useSettings();
  const [manualOpen, setManualOpen] = useState(false);
  /*
   * 初回の測定案内。**ここで持つ理由がある。**
   *
   * - 免責の確認が先。免責は初回に閉じられない作りなので、下から別のモーダルを
   *   開くと確認できなくなる。両方を知っているのはこの階層だけである
   * - **10問モードでは絶対に出さない。** 計時中であり、記録が汚れる。
   *   経路で弾けばモード側の実装に依存せず保証できる
   * - 数値モードには測る操作がないので出さない
   */
  const [guideOpen, setGuideOpen] = useState(false);
  const showGuide =
    guideOpen ||
    (route === '/learn' &&
      settings.vitalsPresentation === 'observed' &&
      !disclaimerOpen &&
      !hasSeenMeasureGuide());

  const dismissGuide = useCallback(() => {
    markMeasureGuideSeen();
    setGuideOpen(false);
  }, []);

  const isCaseRoute = route === '/learn' || route === '/challenge';

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-slate-900 text-slate-100">
      <header className="flex shrink-0 items-center gap-1 border-b border-slate-700 px-2 py-1.5">
        {route !== '/' && (
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label={t('common.back')}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xl text-slate-300 transition active:scale-95"
          >
            <span aria-hidden>‹</span>
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-bold">{t(SCREEN_TITLE[route])}</h1>
        {/*
          測り方への導線。**症例ペインの高さを使わない**ようヘッダーに置く。
          計測器のセルは 150px を使い切っており、判定材料のための高さを削れない
        */}
        {isCaseRoute && (
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            aria-label={t('manual.open')}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xl text-slate-300 transition active:scale-95"
          >
            <span aria-hidden>?</span>
          </button>
        )}
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
          {route === '/' && <HomeScreen onNavigate={navigate} />}
          {route === '/learn' && <LearnMode />}
          {route === '/challenge' && <ChallengeMode onHome={() => navigate('/')} />}
          {route === '/reference' && <ReferenceScreen />}
        </main>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenDisclaimer={openDisclaimer}
      />
      <ManualSheet open={manualOpen} onClose={() => setManualOpen(false)} />
      <ManualSheet open={showGuide && !manualOpen} onClose={dismissGuide} firstRun />
      <UpdateNotice />
      <DisclaimerDialog
        open={disclaimerOpen}
        requireAcknowledgement={needsAcknowledgement}
        onAcknowledge={acknowledge}
        onClose={() => setDisclaimerOpen(false)}
      />
    </div>
  );
}
