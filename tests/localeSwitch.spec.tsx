import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';
import { I18nProvider } from '@/i18n';

function renderApp() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}

describe('言語切替 (docs/I18N.md §4)', () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom の navigator.language は en-US のため、初期言語を URL クエリで明示的に ja に固定する
    // （?lang= 経路そのものの検証にもなる。docs/I18N.md §4）
    window.history.replaceState(null, '', '/?lang=ja');
  });

  it('English を押すと表示が英語になり、html@lang が追従する', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('START法トリアージ・トレーナー');
    expect(document.documentElement.lang).toBe('ja');

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('START Triage Trainer');
    expect(document.documentElement.lang).toBe('en');
  });

  it('選択した言語が localStorage に永続化される', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'English' }));

    const raw = localStorage.getItem('triage-start:v1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ settings: { locale: 'en' } });
  });

  it('言語切替は判定基準プロファイルを変更しない (I18N.md §2)', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'English' }));

    const stored = JSON.parse(localStorage.getItem('triage-start:v1') as string) as {
      settings: { profile: string };
    };
    expect(stored.settings.profile).toBe('JP-FDMA');
  });

  it('英語UIでも採用基準が日本の消防庁標準であることを明示する (I18N.md §2)', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByText(/Japan Fire and Disaster Management Agency/)).toBeInTheDocument();
    expect(screen.getByText(/differ from the original US START/)).toBeInTheDocument();
  });

  it('アクティブな言語ボタンが aria-pressed で示される', () => {
    renderApp();
    expect(screen.getByRole('button', { name: '日本語' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false');
  });
});
