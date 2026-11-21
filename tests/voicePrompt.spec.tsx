import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseCard } from '@/components/CaseCard';
import { SettingsProvider } from '@/app/SettingsProvider';
import { I18nProvider } from '@/i18n';
import type { NonObeyingResponse, TriageCase } from '@/domain/types';

const OBEYING: TriageCase = {
  id: 'voice-ui',
  patient: { illustrationId: 'supine-still', situationKey: 'situation.lyingStill' },
  canWalk: false,
  hasSpontaneousBreathing: true,
  breathingAfterAirway: null,
  respiratoryRate: 18,
  radialPulsePalpable: true,
  pulseRate: 88,
  crtSeconds: 1.2,
  obeysCommands: true,
  nonObeyingResponse: null,
};

const notObeying = (response: NonObeyingResponse): TriageCase => ({
  ...OBEYING,
  id: `voice-ui-${response}`,
  obeysCommands: false,
  nonObeyingResponse: response,
});

function wrap(c: TriageCase, presentation: 'observed' | 'numeric' = 'observed') {
  return render(
    <I18nProvider>
      <SettingsProvider>
        <CaseCard case={c} presentation={presentation} />
      </SettingsProvider>
    </I18nProvider>,
  );
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

describe('声かけの選択肢が常時見える（SPEC §5.1）', () => {
  it('3種類の声かけがダイアログを開かずに見える', () => {
    wrap(OBEYING);

    expect(screen.getByRole('button', { name: '聞こえますか？' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '目を開けてください' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '手を握ってください' })).toBeInTheDocument();
  });

  it('声かけUIがダイアログの中に存在しない', () => {
    const { container } = wrap(OBEYING);
    const button = screen.getByRole('button', { name: '聞こえますか？' });

    expect(button.closest('dialog')).toBeNull();
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('声かけが状況説明文を覆わない', () => {
    const { container } = wrap(OBEYING);
    const group = container.querySelector('[aria-label="声かけ"]') as HTMLElement;
    const caption = screen.getByText('仰向けに倒れて動かない');

    // 重ねる範囲はイラストだけ。説明文が重なり領域の外にあることで、
    // ボタンに隠れないことが保証される
    expect(group.parentElement?.contains(caption)).toBe(false);
  });

  it('イラスト領域に重ねてあり、高さを奪わない', () => {
    const { container } = wrap(OBEYING);
    const group = container.querySelector('[aria-label="声かけ"]') as HTMLElement;

    expect(group.className).toContain('absolute');
    expect(group.closest('.case-figure')).not.toBeNull();
  });
});

describe('押すまで反応を漏らさない', () => {
  it('声をかける前は吹き出しが出ない', () => {
    wrap(notObeying('voiceOnly'));
    expect(screen.queryByText(/うめ|うう|はい|払いのけ|反応がない/)).not.toBeInTheDocument();
  });

  it('押すと症例に応じた反応が返る', async () => {
    const user = userEvent.setup();
    wrap(OBEYING);

    await user.click(screen.getByRole('button', { name: '手を握ってください' }));
    expect(screen.getByText('手を握り返した')).toBeInTheDocument();
  });

  it('同じ声かけを繰り返しても反応が変わらない（症例の性質であるため）', async () => {
    const user = userEvent.setup();
    wrap(notObeying('movementOnly'));

    const button = screen.getByRole('button', { name: '手を握ってください' });
    await user.click(button);
    expect(screen.getByText('手を払いのけた')).toBeInTheDocument();
    await user.click(button);
    expect(screen.getByText('手を払いのけた')).toBeInTheDocument();
  });
});

describe('反応があることと従命できることは違う', () => {
  it('声のみの症例は、握手を求めてもうめくだけ', async () => {
    const user = userEvent.setup();
    wrap(notObeying('voiceOnly'));

    await user.click(screen.getByRole('button', { name: '手を握ってください' }));
    expect(screen.getByText('うめくだけで手は動かない')).toBeInTheDocument();
  });

  it('体動のみの症例は、開眼を求めても顔をしかめるだけ', async () => {
    const user = userEvent.setup();
    wrap(notObeying('movementOnly'));

    await user.click(screen.getByRole('button', { name: '目を開けてください' }));
    expect(screen.getByText('顔をしかめたが目は開けない')).toBeInTheDocument();
  });

  it('無反応の症例はどの声かけでも反応がない', async () => {
    const user = userEvent.setup();
    wrap(notObeying('none'));

    for (const name of ['聞こえますか？', '目を開けてください', '手を握ってください']) {
      await user.click(screen.getByRole('button', { name }));
      expect(screen.getByText('反応がない')).toBeInTheDocument();
    }
  });

  it('呼名には応じるが、それは従命の確認にならない', async () => {
    const user = userEvent.setup();
    wrap(OBEYING);

    await user.click(screen.getByRole('button', { name: '聞こえますか？' }));
    // 「はい」と答えるだけで、指示に従ったわけではない
    expect(screen.getByText('「はい」と答えた')).toBeInTheDocument();
  });
});

describe('数値モードでは声かけを出さない', () => {
  it('声かけボタンが無く、指示応答の値が出る', () => {
    wrap(OBEYING, 'numeric');

    expect(screen.queryByRole('button', { name: '聞こえますか？' })).not.toBeInTheDocument();
    expect(screen.getByText('従える')).toBeInTheDocument();
  });
});

describe('声かけは回答の前提条件ではない', () => {
  it('声をかけなくても画面は成立する', () => {
    const { container } = wrap(OBEYING);
    // 吹き出しが無いだけで、他の操作は妨げられない
    expect(container.querySelector('[aria-label="声かけ"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: '呼吸を数える' })).toBeEnabled();
  });
});

describe('アクセシビリティ', () => {
  it('吹き出しが読み上げられる', async () => {
    const user = userEvent.setup();
    const { container } = wrap(OBEYING);

    await user.click(screen.getByRole('button', { name: '目を開けてください' }));
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('目を開けた');
  });

  it('行った声かけが aria-pressed で示される', async () => {
    const user = userEvent.setup();
    wrap(OBEYING);

    const button = screen.getByRole('button', { name: '目を開けてください' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('ボタンの読み上げ名が完全な文である（短縮表示とは別に）', () => {
    wrap(OBEYING);
    const button = screen.getByRole('button', { name: '手を握ってください' });
    // 画面には短縮形、読み上げには完全な声かけ
    expect(button.textContent).toBe('手を握って');
  });
});
