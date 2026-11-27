import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import { SettingsProvider } from '@/app/SettingsProvider';
import { I18nProvider } from '@/i18n';
import { MIN_ESTIMATE_MS } from '@/domain/breathing';
import { MIN_TAPS_FOR_ESTIMATE } from '@/domain/tapCounting';
import { acknowledgeDisclaimer, hasSeenMeasureGuide, markMeasureGuideSeen, patchSettings } from '@/lib/storage';

/**
 * 測定のしかた（SPEC §2.1 / S5）。
 *
 * 利用者から「押せば結果が出ると思った」という報告があったことへの対応。
 * **誤解を名指しで否定する文が出ていること**を、文面の有無として検査する。
 */

function renderApp(route = '/') {
  window.history.replaceState(null, '', `${route}?lang=ja`);
  return render(
    <I18nProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </I18nProvider>,
  );
}

async function dismissDisclaimer(user: ReturnType<typeof userEvent.setup>) {
  const button = screen.queryByRole('button', { name: '確認しました' });
  if (button !== null) await user.click(button);
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/?lang=ja');
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

describe('リファレンスの「測定のしかた」', () => {
  it('節が最後に出る（採用基準を長文の下へ埋めない）', () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    renderApp('/reference');

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['判定フロー', 'トリアージ区分', '採用している基準値', '測定のしかた']);
  });

  it('「押せば結果が出る」という誤解を先頭で否定する', () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    renderApp('/reference');

    expect(screen.getByText(/ボタンを押しても測定結果は出ません/)).toBeInTheDocument();
    expect(screen.getByText(/数えるのも時間を計るのも利用者自身/)).toBeInTheDocument();
  });

  it('推定値が出る条件を数値で書く', () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    renderApp('/reference');

    // ドメインの定数とずれないこと。文面だけ直して条件が変わる事故を防ぐ
    const text = screen.getByText(/推定値が出ます/).textContent;
    expect(text).toContain(String(MIN_TAPS_FOR_ESTIMATE));
    expect(text).toContain(String(MIN_ESTIMATE_MS / 1000));
  });

  it('「壊れて見えるが仕様」の2点を書く', () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    renderApp('/reference');

    // 推定が「—」のままになること
    expect(screen.getByText(/タップは記録されています/)).toBeInTheDocument();
    // 触知不能では何も動かずボタンも出ないこと
    expect(screen.getByText(/押すボタンも出ません/)).toBeInTheDocument();
  });

  it('測定が任意であることを書く', () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    renderApp('/reference');
    expect(screen.getByText(/測らずに区分を選んでもかまいません/)).toBeInTheDocument();
  });
});

describe('初回の案内', () => {
  it('実測モードで学習モードを初めて開くと出る', async () => {
    acknowledgeDisclaimer();
    const user = userEvent.setup();
    renderApp('/learn');
    await dismissDisclaimer(user);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/ボタンを押しても測定結果は出ません/)).toBeInTheDocument();
  });

  it('閉じると記録され、二度と出ない', async () => {
    acknowledgeDisclaimer();
    const user = userEvent.setup();
    const first = renderApp('/learn');
    await user.click(screen.getByRole('button', { name: 'はじめる' }));
    expect(hasSeenMeasureGuide()).toBe(true);
    first.unmount();

    renderApp('/learn');
    expect(screen.queryByText(/ボタンを押しても測定結果は出ません/)).not.toBeInTheDocument();
  });

  it('数値モードでは出ない', () => {
    acknowledgeDisclaimer();
    patchSettings({ vitalsPresentation: 'numeric' });
    renderApp('/learn');
    expect(screen.queryByText(/ボタンを押しても測定結果は出ません/)).not.toBeInTheDocument();
  });

  it('10問モードでは出ない（計時を汚さない）', () => {
    acknowledgeDisclaimer();
    renderApp('/challenge');
    expect(screen.queryByText(/ボタンを押しても測定結果は出ません/)).not.toBeInTheDocument();
    expect(hasSeenMeasureGuide()).toBe(false);
  });

  it('免責の確認が終わるまでは出ない', () => {
    // 免責は初回に閉じられない。下から別のモーダルを開くと確認できなくなる
    renderApp('/learn');
    expect(screen.getByText(/確認しました/)).toBeInTheDocument();
    expect(screen.queryByText(/ボタンを押しても測定結果は出ません/)).not.toBeInTheDocument();
  });
});

describe('計測器からの導線', () => {
  it('症例画面から「測り方」を開ける', async () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    const user = userEvent.setup();
    renderApp('/learn');

    await user.click(screen.getByRole('button', { name: '測り方' }));
    expect(screen.getByText(/ボタンを押しても測定結果は出ません/)).toBeInTheDocument();
  });

  it('開いても画面遷移しない（測りかけの状態を失わない）', async () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    const user = userEvent.setup();
    renderApp('/learn');

    // 2回数えてから開く
    const tap = screen.getByRole('button', { name: '呼吸ごとに押す' });
    await user.click(tap);
    await user.click(tap);
    expect(screen.getByText('2 回')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '測り方' }));
    await user.click(screen.getByRole('button', { name: '閉じる' }));

    expect(window.location.pathname).toBe('/learn');
    expect(screen.getByText('2 回'), '計数が失われている').toBeInTheDocument();
  });

  it('ホーム画面には出さない', () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    renderApp('/');
    expect(screen.queryByRole('button', { name: '測り方' })).not.toBeInTheDocument();
  });
});

describe('計測ボタンの文言', () => {
  it('アプリへの命令ではなく、利用者の動作を言う', async () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    const user = userEvent.setup();
    renderApp('/learn');
    await dismissDisclaimer(user);

    // 「呼吸を数える」はアプリが数えてくれるように読める
    expect(screen.queryByRole('button', { name: '呼吸を数える' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '呼吸ごとに押す' })).toBeInTheDocument();
  });

  it('押しても推定が出ない間、理由を示す', async () => {
    acknowledgeDisclaimer();
    markMeasureGuideSeen();
    const user = userEvent.setup();
    renderApp('/learn');

    await user.click(screen.getByRole('button', { name: '呼吸ごとに押す' }));
    // 「—」のままでは故障に見える
    expect(screen.getByText('もう少し数えると推定値が出ます')).toBeInTheDocument();
  });
});
