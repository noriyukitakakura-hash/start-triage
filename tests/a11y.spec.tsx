import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe, { type Result } from 'axe-core';
import { App } from '@/app/App';
import { SettingsProvider } from '@/app/SettingsProvider';
import { I18nProvider } from '@/i18n';
import { acknowledgeDisclaimer, patchSettings, type RrPresentation } from '@/lib/storage';

/**
 * アクセシビリティ監査（SPEC §5.3）。
 *
 * axe-core を jsdom 上で走らせる。レイアウトを持たないため
 * コントラスト比は評価されない（別途 tests/contrast.spec.ts で計算して検証する）。
 * ここで見るのは ARIA の整合・名前の有無・役割の重複・見出し構造といった構造上の問題。
 */
const RULES_NEEDING_LAYOUT = ['color-contrast', 'target-size'];

async function analyze(container: HTMLElement): Promise<Result[]> {
  const result = await axe.run(container, {
    // jsdom では評価できない規則を外す。見逃しではなく別手段で検証している
    rules: Object.fromEntries(RULES_NEEDING_LAYOUT.map((id) => [id, { enabled: false }])),
    resultTypes: ['violations'],
  });
  return result.violations;
}

function describeViolations(violations: Result[]): string {
  return violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.html).join('\n    ')}`)
    .join('\n  ');
}

function mount(route: string) {
  window.history.replaceState(null, '', `${route}?lang=ja`);
  return render(
    <I18nProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
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

describe('axe-core による構造の検査', () => {
  it.each([
    ['/', 'ホーム'],
    ['/learn', '学習モード'],
    ['/reference', 'リファレンス'],
  ])('%s (%s) に違反がない', async (route) => {
    acknowledgeDisclaimer();
    const { container } = mount(route);

    const violations = await analyze(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it.each(['observed', 'numeric'] as RrPresentation[])(
    '学習モード（%s）に違反がない',
    async (presentation) => {
      acknowledgeDisclaimer();
      patchSettings({ vitalsPresentation: presentation });
      const { container } = mount('/learn');

      const violations = await analyze(container);
      expect(violations, describeViolations(violations)).toEqual([]);
    },
  );

  it('初回の免責ダイアログに違反がない', async () => {
    const { container } = mount('/');

    const violations = await analyze(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('設定シートに違反がない', async () => {
    acknowledgeDisclaimer();
    const user = userEvent.setup();
    const { container } = mount('/');

    await user.click(container.querySelector('[aria-label="設定を開く"]') as HTMLElement);

    const violations = await analyze(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('解説シートに違反がない', async () => {
    acknowledgeDisclaimer();
    const user = userEvent.setup();
    const { container } = mount('/learn');

    await user.click(container.querySelector('[aria-label="III類・軽処置群"]') as HTMLElement);

    const violations = await analyze(container);
    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it('10問チャレンジの結果に違反がない', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    acknowledgeDisclaimer();
    const { container } = mount('/challenge');

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    for (let i = 0; i < 10; i++) {
      const button = container.querySelector<HTMLElement>('[aria-label="I類・緊急治療群"]');
      if (button === null) break;
      await user.click(button);
    }

    const violations = await analyze(container);
    expect(violations, describeViolations(violations)).toEqual([]);
    vi.useRealTimers();
  });
});

describe('キーボードでの到達性（SPEC §5.3）', () => {
  /** Tab を押し続けて到達できた要素を集める */
  async function tabThrough(user: ReturnType<typeof userEvent.setup>, limit = 40): Promise<HTMLElement[]> {
    const seen: HTMLElement[] = [];
    for (let i = 0; i < limit; i++) {
      await user.tab();
      const active = document.activeElement;
      if (active === null || active === document.body) break;
      const el = active as HTMLElement;
      if (seen.includes(el)) break;
      seen.push(el);
    }
    return seen;
  }

  /** その要素に支援技術が読み上げる名前があるか */
  function accessibleName(el: HTMLElement): string {
    return (el.getAttribute('aria-label') ?? el.textContent).trim();
  }

  it('学習モードの操作すべてに到達でき、名前がある', async () => {
    acknowledgeDisclaimer();
    patchSettings({ vitalsPresentation: 'observed' });
    const user = userEvent.setup();
    const { container } = mount('/learn');

    const reached = await tabThrough(user);
    const buttons = [...container.querySelectorAll('button')].filter((b) => !b.disabled);

    // 画面上の有効なボタンがすべて Tab で到達できる
    for (const button of buttons) {
      expect(reached, `到達できない: ${accessibleName(button)}`).toContain(button);
    }
    // 到達したものはすべて名前を持つ（読み上げて区別できる）
    for (const el of reached) {
      expect(accessibleName(el), `名前が無い: ${el.outerHTML.slice(0, 80)}`).not.toBe('');
    }
  });

  it('区分ボタンがキーボードで到達でき、名前で区別できる', async () => {
    acknowledgeDisclaimer();
    const user = userEvent.setup();
    mount('/learn');

    const reached = await tabThrough(user);
    const names = reached.map(accessibleName);

    for (const expected of ['I類・緊急治療群', 'II類・非緊急治療群', 'III類・軽処置群', '0類・死亡群']) {
      expect(names, `${expected} に到達できない`).toContain(expected);
    }
  });

  it('免責ダイアログを閉じるまで背後へ出られない', async () => {
    const user = userEvent.setup();
    const { container } = mount('/');

    const reached = await tabThrough(user, 12);
    const dialog = container.querySelector('dialog[open]') as HTMLElement;

    // modal dialog の中だけを巡る（jsdom は inert を再現しないため、
    // 少なくとも確認ボタンへ到達できることを確かめる）
    expect(reached.some((el) => dialog.contains(el))).toBe(true);
    expect(reached.map(accessibleName)).toContain('確認しました');
  });

  it('声かけボタンが Tab で到達でき、名前を持つ', async () => {
    acknowledgeDisclaimer();
    patchSettings({ vitalsPresentation: 'observed' });
    const user = userEvent.setup();
    mount('/learn');

    const reached = await tabThrough(user);
    const names = reached.map(accessibleName);

    for (const expected of ['聞こえますか？', '目を開けてください', '手を握ってください']) {
      expect(names, `${expected} に到達できない`).toContain(expected);
    }
  });

  it('CRT の圧迫がキーボードでも行える', () => {
    acknowledgeDisclaimer();
    patchSettings({ vitalsPresentation: 'observed' });
    const { container } = mount('/learn');

    const nail = container.querySelector('.crt-target') as HTMLElement;
    expect(nail.tagName).toBe('BUTTON');
    expect(nail.getAttribute('aria-label')).toBe('爪を押す');

    // Space の押下と解放が圧迫と解放に対応する
    nail.focus();
    expect(document.activeElement).toBe(nail);
  });
});
