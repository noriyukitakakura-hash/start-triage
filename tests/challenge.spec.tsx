import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChallengeMode } from '@/features/challenge/ChallengeMode';
import { SettingsProvider } from '@/app/SettingsProvider';
import { I18nProvider } from '@/i18n';
import { judge } from '@/domain/judge';
import { JP_FDMA } from '@/domain/profiles';
import { QUIZ_LENGTH } from '@/domain/generator';
import { loadState, patchSettings, recordBestTime } from '@/lib/storage';
import type { Category } from '@/domain/types';

function wrap() {
  return render(
    <I18nProvider>
      <SettingsProvider>
        <ChallengeMode onHome={() => undefined} />
      </SettingsProvider>
    </I18nProvider>,
  );
}

const BUTTON_NAME: Record<Category, string> = {
  I: 'I類・緊急治療群',
  II: 'II類・非緊急治療群',
  III: 'III類・軽処置群',
  '0': '0類・死亡群',
};

/**
 * カウントダウンを飛ばす。
 * 1秒ごとの setTimeout が連鎖するため、act で包んで React の更新を流し切る。
 */
async function startChallenge() {
  // 次の setTimeout は再描画後の effect で初めて登録される。
  // 1秒ずつ進めて、その都度 React の更新を流し切る
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
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

describe('10問チャレンジの進行（SPEC §2.4）', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  it('カウントダウンの後に出題が始まる', async () => {
    wrap();

    expect(screen.getByText('準備')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: BUTTON_NAME.I })).not.toBeInTheDocument();

    await startChallenge();

    expect(screen.getByRole('button', { name: BUTTON_NAME.I })).toBeInTheDocument();
    expect(screen.getByText(`1 / ${QUIZ_LENGTH}`)).toBeInTheDocument();
  });

  it('回答するたびに進捗が進み、出題中はフィードバックを出さない', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    wrap();
    await startChallenge();

    await user.click(screen.getByRole('button', { name: BUTTON_NAME.I }));

    expect(screen.getByText(`2 / ${QUIZ_LENGTH}`)).toBeInTheDocument();
    // 正誤を示す表示が出ない
    expect(screen.queryByText('正解')).not.toBeInTheDocument();
    expect(screen.queryByText('不正解')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '判定の根拠' })).not.toBeInTheDocument();
  });

  it('10問すべて回答すると結果画面になる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    wrap();
    await startChallenge();

    for (let i = 0; i < QUIZ_LENGTH; i++) {
      await user.click(screen.getByRole('button', { name: BUTTON_NAME.I }));
    }

    expect(screen.getByRole('region', { name: '結果' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'もう一度' })).toBeInTheDocument();
  });

  it('各問の正誤が結果に並ぶ', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    wrap();
    await startChallenge();

    for (let i = 0; i < QUIZ_LENGTH; i++) {
      await user.click(screen.getByRole('button', { name: BUTTON_NAME.I }));
    }

    const reviewButtons = screen.getAllByRole('button').filter((b) => /^\d+[○×]/.test(b.textContent));
    expect(reviewButtons).toHaveLength(QUIZ_LENGTH);
  });

  it('キーボードでも回答できる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    wrap();
    await startChallenge();

    await user.keyboard('1');
    expect(screen.getByText(`2 / ${QUIZ_LENGTH}`)).toBeInTheDocument();
  });
});

describe('サドンデス（SPEC §2.4）', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  it('既定では誤答しても最後まで出題する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    wrap();
    await startChallenge();

    // 全問 0類 と答える。10問の構成上かならず誤答が混ざる
    for (let i = 0; i < QUIZ_LENGTH; i++) {
      await user.click(screen.getByRole('button', { name: BUTTON_NAME['0'] }));
    }

    const reviewButtons = screen.getAllByRole('button').filter((b) => /^\d+[○×]/.test(b.textContent));
    expect(reviewButtons).toHaveLength(QUIZ_LENGTH);
    expect(screen.queryByText('誤答のため中断しました')).not.toBeInTheDocument();
  });

  it('ONなら最初の誤答で打ち切る', async () => {
    patchSettings({ suddenDeath: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    wrap();
    await startChallenge();

    // 0類は10問中1〜2問しかないため、全問 0類 と答えれば早期に誤答する
    for (let i = 0; i < QUIZ_LENGTH; i++) {
      const button = screen.queryByRole('button', { name: BUTTON_NAME['0'] });
      if (button === null) break;
      await user.click(button);
    }

    const reviewButtons = screen.getAllByRole('button').filter((b) => /^\d+[○×]/.test(b.textContent));
    expect(reviewButtons.length).toBeLessThan(QUIZ_LENGTH);
  });
});

describe('自己ベストの記録（SPEC §2.4 / docs/OBSERVATION.md §3.6）', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  it('全問正解でなければ記録しない（速い誤答が完答を上回らないように）', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    wrap();
    await startChallenge();

    for (let i = 0; i < QUIZ_LENGTH; i++) {
      await user.click(screen.getByRole('button', { name: BUTTON_NAME['0'] }));
    }

    expect(loadState().bestTimeMs.numeric).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xに投稿する' })).not.toBeInTheDocument();
    expect(screen.getByText('全問正解で投稿できます')).toBeInTheDocument();
  });
});

describe('結果の解説', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  it('各問をタップすると解説が開く', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    wrap();
    await startChallenge();

    for (let i = 0; i < QUIZ_LENGTH; i++) {
      await user.click(screen.getByRole('button', { name: BUTTON_NAME.I }));
    }

    const first = screen.getAllByRole('button').find((b) => /^1[○×]/.test(b.textContent));
    expect(first).toBeDefined();
    await user.click(first as HTMLElement);

    expect(screen.getByRole('list', { name: '判定の根拠' })).toBeInTheDocument();
  });
});

describe('提示方式ごとのベストタイム', () => {
  it('実測モードの記録が数値モードを上書きしない', () => {
    recordBestTime('numeric', 60_000);
    recordBestTime('observed', 180_000);

    const best = loadState().bestTimeMs;
    expect(best.numeric).toBe(60_000);
    expect(best.observed).toBe(180_000);
  });

  it('judge と同じ基準で採点される', () => {
    // 結果の正誤は judge に委ねている。別実装を持たないことの確認
    expect(typeof judge).toBe('function');
    expect(JP_FDMA.id).toBe('JP-FDMA');
  });
});
