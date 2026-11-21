import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import { SettingsProvider } from '@/app/SettingsProvider';
import { I18nProvider } from '@/i18n';
import { acknowledgeDisclaimer, patchSettings } from '@/lib/storage';

/**
 * レイアウトの不変条件（SPEC §5.1）。
 *
 * jsdom は実レイアウトを計算しないため高さは検証できない。
 * **「ページ本体をスクロールさせない」ための構造の約束**を検査する。
 * 実寸での確認は別途、各ビューポートで描画して目視する。
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

describe('ページ本体をスクロールさせない', () => {
  it('ルートがビューポート高に固定され、はみ出しを隠す', () => {
    const { container } = renderApp();
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain('h-dvh');
    expect(root.className).toContain('overflow-hidden');
  });

  it('ルートが行グリッドで、最終行の内容量に押し広げられない', () => {
    const { container } = renderApp();
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain('grid-rows-');
    // minmax(0,1fr) がないと可変行が内容量で膨らみ、overflow-hidden が効かなくなる
    expect(root.className).toContain('minmax(0,1fr)');
  });

  /*
   * スクロールを許すのは「読み物」であるリファレンス画面とシートの内部だけ。
   * 判断を行う画面（ホーム・学習・チャレンジ）は収まりきること自体が要件である。
   */
  it.each(['/', '/learn', '/challenge'])('%s にスクロール領域を作らない', async (route) => {
    const user = userEvent.setup();
    const { container } = renderApp(route);
    await dismissDisclaimer(user);

    const scrollable = [...container.querySelectorAll('*')].filter(
      (el) => el.className.toString().includes('overflow-y-auto') && el.closest('dialog') === null,
    );
    expect(scrollable).toEqual([]);
  });

  it('リファレンスは読み物なので内部スクロールを許すが、ページ本体は固定のまま', async () => {
    const user = userEvent.setup();
    const { container } = renderApp('/reference');
    await dismissDisclaimer(user);

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('overflow-hidden');
    expect(container.querySelector('.overflow-y-auto')).toBeTruthy();
  });

  it('症例ペインが min-h-0 を持ち、イラストが余剰高を吸収する', async () => {
    const user = userEvent.setup();
    const { container } = renderApp('/learn');
    await dismissDisclaimer(user);

    const figure = container.querySelector('svg.patient-figure') as HTMLElement;
    expect(figure.getAttribute('class')).toContain('h-full');
    expect(figure.getAttribute('class')).toContain('flex-1');

    const pane = screen.getByRole('region', { name: '学習モード' });
    expect(pane.className).toContain('min-h-0');
  });
});

describe('計測器の常時表示（SPEC §5.1）', () => {
  it.each(['observed', 'numeric'] as const)(
    '%s モードでも /learn にスクロール領域が生まれない',
    async (presentation) => {
      patchSettings({ vitalsPresentation: presentation });
      const user = userEvent.setup();
      const { container } = renderApp('/learn');
      await dismissDisclaimer(user);

      const scrollable = [...container.querySelectorAll('*')].filter(
        (el) => el.className.toString().includes('overflow-y-auto') && el.closest('dialog') === null,
      );
      expect(scrollable).toEqual([]);
    },
  );

  it('声かけを重ねてもイラストの flex-1 を壊さない', async () => {
    patchSettings({ vitalsPresentation: 'observed' });
    const user = userEvent.setup();
    const { container } = renderApp('/learn');
    await dismissDisclaimer(user);

    const voice = container.querySelector('[aria-label="声かけ"]') as HTMLElement;
    // 重ねているので、イラストの高さ配分には影響しない
    expect(voice.className).toContain('absolute');
    expect(voice.closest('.case-figure')).not.toBeNull();

    const figure = container.querySelector('svg.patient-figure') as HTMLElement;
    expect(figure.getAttribute('class')).toContain('flex-1');
  });

  it('計測器が症例ペイン内にあり、イラストが余剰高を吸収する構造を保つ', async () => {
    patchSettings({ vitalsPresentation: 'observed' });
    const user = userEvent.setup();
    const { container } = renderApp('/learn');
    await dismissDisclaimer(user);

    const figure = container.querySelector('svg.patient-figure') as HTMLElement;
    expect(figure.getAttribute('class')).toContain('flex-1');

    // 計測器はダイアログではなく症例カードの中にある
    const nail = container.querySelector('.crt-nail');
    expect(nail).not.toBeNull();
    expect(nail?.closest('dialog')).toBeNull();
    expect(nail?.closest('article')).not.toBeNull();
  });
});

describe('高さに応じたレイアウト切り替え', () => {
  /*
   * 切り替えはコンテナクエリ（index.css の `@container pane`）で行う。
   * jsdom はコンテナクエリを評価しないため、ここでは**構造の約束**だけを検査し、
   * 実際の切り替わりは各ビューポートでの描画で目視確認する。
   */
  it('症例ペインがサイズコンテナとして宣言されている', async () => {
    const user = userEvent.setup();
    renderApp();
    await dismissDisclaimer(user);

    const main = screen.getByRole('main');
    const pane = main.parentElement as HTMLElement;
    expect(pane.className).toContain('case-pane');
    expect(pane.className).toContain('min-h-0');
    expect(main.className).toContain('case-main');
  });

  it('切り替え対象の要素が規定のクラスを持つ', async () => {
    const user = userEvent.setup();
    const { container } = renderApp('/learn');
    await dismissDisclaimer(user);

    const card = container.querySelector('article') as HTMLElement;
    expect(card.className).toContain('case-layout');
    // 既定（高さに余裕がある場合）は縦積み
    expect(card.className).toContain('flex-col');

    expect(container.querySelector('.case-figure')).toBeTruthy();
    expect(container.querySelector('.case-info')).toBeTruthy();
  });
});

describe('常時表示を減らす（SPEC §5.1）', () => {
  it('免責文は出題画面に常時表示しない', async () => {
    const user = userEvent.setup();
    const { container } = renderApp('/learn');
    await dismissDisclaimer(user);

    expect(container.textContent).not.toContain('教育・訓練目的のシミュレーション');
  });

  it('提示方式と言語の切替は出題画面に出さない', async () => {
    const user = userEvent.setup();
    renderApp();
    await dismissDisclaimer(user);

    expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
    expect(screen.queryByText('呼吸数の提示')).not.toBeInTheDocument();
  });

  it('設定シートから提示方式と言語にたどり着ける', async () => {
    const user = userEvent.setup();
    renderApp();
    await dismissDisclaimer(user);

    await user.click(screen.getByRole('button', { name: '設定を開く' }));

    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByText('呼吸数の提示')).toBeInTheDocument();
  });
});

describe('免責の確認（SPEC §1.7）', () => {
  it('初回はダイアログで明示的な確認を求める', () => {
    const { container } = renderApp();

    const dialog = container.querySelector('dialog[open]') as HTMLDialogElement;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('教育・訓練目的のシミュレーション');
    expect(dialog.textContent).toContain('消防庁標準');
    expect(screen.getByRole('button', { name: '確認しました' })).toBeInTheDocument();
  });

  it('確認すると閉じ、記録される', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: '確認しました' }));

    expect(screen.queryByRole('button', { name: '確認しました' })).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem('triage-start:v1') as string) as {
      disclaimerAckVersion: number;
    };
    expect(stored.disclaimerAckVersion).toBe(1);
  });

  it('確認済みなら次回以降は出ない', () => {
    acknowledgeDisclaimer();
    renderApp();

    expect(screen.queryByRole('button', { name: '確認しました' })).not.toBeInTheDocument();
  });

  it('初回確認は Esc で閉じられない（読まずに進ませない）', () => {
    const { container } = renderApp();
    const dialog = container.querySelector('dialog[open]') as HTMLDialogElement;

    const event = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: '確認しました' })).toBeInTheDocument();
  });

  it('設定からいつでも読み直せる', async () => {
    const user = userEvent.setup();
    acknowledgeDisclaimer();
    renderApp();

    await user.click(screen.getByRole('button', { name: '設定を開く' }));
    await user.click(screen.getByRole('button', { name: '免責・判定基準について' }));

    expect(screen.getByText(/教育・訓練目的のシミュレーション/)).toBeInTheDocument();
    // 再読では閉じられる
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument();
  });
});

describe('解説はシートの中だけに存在する', () => {
  it('回答前は解説がどこにもない', async () => {
    const user = userEvent.setup();
    renderApp('/learn');
    await dismissDisclaimer(user);

    expect(screen.queryByRole('list', { name: '判定の根拠' })).not.toBeInTheDocument();
  });

  it('回答後の解説はシート内にあり、本体には出ない', async () => {
    const user = userEvent.setup();
    renderApp('/learn');
    await dismissDisclaimer(user);

    await user.click(screen.getByRole('button', { name: 'III類・軽処置群' }));

    const flow = screen.getByRole('list', { name: '判定の根拠' });
    expect(flow.closest('dialog')).not.toBeNull();
  });
});
