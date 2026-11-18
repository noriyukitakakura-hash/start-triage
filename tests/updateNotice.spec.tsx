import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateNotice } from '@/components/UpdateNotice';
import { I18nProvider } from '@/i18n';

/**
 * 更新通知の振る舞い（SPEC §4.5）。
 *
 * **自動では切り替えない。** 10問チャレンジの最中に再読み込みされると
 * 計測中の記録が失われるため、切り替えは利用者が選ぶ。
 */
const listeners = new Set<(available: boolean) => void>();
const applyUpdate = vi.fn();

vi.mock('@/lib/pwa', () => ({
  onUpdateAvailable: (listener: (available: boolean) => void) => {
    listeners.add(listener);
    listener(false);
    return () => {
      listeners.delete(listener);
    };
  },
  applyUpdate: () => {
    applyUpdate();
  },
}));

function announceUpdate(available: boolean): void {
  act(() => {
    for (const listener of listeners) listener(available);
  });
}

function wrap() {
  return render(
    <I18nProvider>
      <UpdateNotice />
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/?lang=ja');
  listeners.clear();
  applyUpdate.mockClear();
});

describe('更新通知', () => {
  it('更新が無いときは何も出さない', () => {
    const { container } = wrap();
    expect(container.textContent).toBe('');
  });

  it('更新があると知らせるが、勝手に切り替えない', () => {
    wrap();
    announceUpdate(true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/新しい版が利用できます/)).toBeInTheDocument();
    // 知らせた時点では切り替えを行わない
    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('訓練の区切りで更新するよう促す', () => {
    wrap();
    announceUpdate(true);
    expect(screen.getByText(/訓練の区切りで/)).toBeInTheDocument();
  });

  it('利用者が押したときだけ切り替える', async () => {
    const user = userEvent.setup();
    wrap();
    announceUpdate(true);

    await user.click(screen.getByRole('button', { name: '更新' }));
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('閉じれば消える（訓練を妨げない）', async () => {
    const user = userEvent.setup();
    wrap();
    announceUpdate(true);

    await user.click(screen.getByRole('button', { name: '閉じる' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('回答ボタンを覆わない位置に出す', () => {
    const { container } = wrap();
    announceUpdate(true);

    const notice = container.querySelector('[role="status"]') as HTMLElement;
    // 画面外クリックを妨げないよう、枠自体はポインタを透過させる
    expect(notice.className).toContain('pointer-events-none');
    expect(notice.className).toContain('fixed');
  });
});
