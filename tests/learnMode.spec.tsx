import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseCard } from '@/components/CaseCard';
import { VitalsBar } from '@/components/vitals/VitalsBar';
import { LearnMode } from '@/features/learn/LearnMode';
import { CountFeedback } from '@/features/learn/CountFeedback';
import { EMPTY_COUNT } from '@/domain/tapCounting';
import { JP_FDMA } from '@/domain/profiles';
import { SettingsProvider } from '@/app/SettingsProvider';
import { I18nProvider } from '@/i18n';
import { patchSettings, type RrPresentation } from '@/lib/storage';
import type { TriageCase } from '@/domain/types';

const BREATHING: TriageCase = {
  id: 'ui-test',
  patient: { illustrationId: 'supine-still', situationKey: 'situation.lyingStill' },
  canWalk: false,
  hasSpontaneousBreathing: true,
  breathingAfterAirway: null,
  respiratoryRate: 36,
  radialPulsePalpable: true,
  pulseRate: 110,
  crtSeconds: 1.4,
  obeysCommands: true,
};

const APNEIC: TriageCase = {
  ...BREATHING,
  id: 'ui-test-apneic',
  hasSpontaneousBreathing: false,
  breathingAfterAirway: false,
  respiratoryRate: 0,
  obeysCommands: false,
};

function stubMatchMedia(reduce: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

/**
 * 解説は回答後にボトムシートで開く（SPEC §5.1）。
 * 区分ボタンは回答後に消えるため、回答は1回だけ行う。
 */
async function answer(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name }));
}

function wrap(node: React.ReactNode) {
  return render(
    <I18nProvider>
      <SettingsProvider>{node}</SettingsProvider>
    </I18nProvider>,
  );
}

function renderCard(c: TriageCase, presentation: RrPresentation) {
  return wrap(<CaseCard case={c} presentation={presentation} />);
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/?lang=ja');
  stubMatchMedia(false);
});

describe('気道確保ボタンが答えを漏らさない（docs/OBSERVATION.md §3.1）', () => {
  it('実測モードでは自発呼吸の有無にかかわらず表示される', () => {
    renderCard(BREATHING, 'observed');
    expect(screen.getByRole('button', { name: '気道確保を行う' })).toBeInTheDocument();

    renderCard(APNEIC, 'observed');
    expect(screen.getAllByRole('button', { name: '気道確保を行う' })).toHaveLength(2);
  });

  it('数値モードでは無呼吸の症例のみ表示される', () => {
    renderCard(BREATHING, 'numeric');
    expect(screen.queryByRole('button', { name: '気道確保を行う' })).not.toBeInTheDocument();

    renderCard(APNEIC, 'numeric');
    expect(screen.getByRole('button', { name: '気道確保を行う' })).toBeInTheDocument();
  });

  it('押す前は結果を表示しない', () => {
    renderCard(APNEIC, 'observed');
    expect(screen.queryByText(/気道確保後も自発呼吸がありません/)).not.toBeInTheDocument();
  });

  it('自発呼吸がある症例では「気道確保は不要」を返す', async () => {
    const user = userEvent.setup();
    renderCard(BREATHING, 'observed');

    await user.click(screen.getByRole('button', { name: '気道確保を行う' }));
    expect(screen.getByText(/自発呼吸を確認。気道確保は不要です/)).toBeInTheDocument();
  });

  it('気道確保後も呼吸がない症例は 0類 の手がかりを返す', async () => {
    const user = userEvent.setup();
    renderCard(APNEIC, 'observed');

    await user.click(screen.getByRole('button', { name: '気道確保を行う' }));
    expect(screen.getByText(/気道確保後も自発呼吸がありません/)).toBeInTheDocument();
  });

  it('気道確保により呼吸が再開する症例は再開を返す', async () => {
    const user = userEvent.setup();
    renderCard({ ...APNEIC, breathingAfterAirway: true }, 'observed');

    await user.click(screen.getByRole('button', { name: '気道確保を行う' }));
    expect(screen.getByText(/気道確保により呼吸が再開しました/)).toBeInTheDocument();
  });
});

describe('実測モードは呼吸数の数値を画面に出さない', () => {
  it('呼吸数・CRT・脈拍の真の値が画面に出ない', () => {
    const { container } = renderCard(BREATHING, 'observed');
    // 自分で測る項目の真の値は、sr-only を除いて画面に出ない
    const visible = [...container.querySelectorAll('*')]
      .filter((el) => el.closest('.sr-only') === null && el.children.length === 0)
      .map((el) => el.textContent);

    expect(visible.some((x) => x.includes('36')), '呼吸数が漏れている').toBe(false);
    expect(visible.some((x) => x.includes('110')), '脈拍が漏れている').toBe(false);
    expect(visible.some((x) => x.includes('1.4')), 'CRTが漏れている').toBe(false);
    // 判定に必要だが自分では測らない項目は従来どおり表示する
    expect(visible.some((x) => x.includes('従える'))).toBe(true);
  });

  it('数値モードでは呼吸数を表示する', () => {
    renderCard(BREATHING, 'numeric');
    expect(screen.getByText('36 回/分')).toBeInTheDocument();
  });

  it('支援技術には常に呼吸数を渡す（SPEC §5.3 の代替手段）', () => {
    const { container } = renderCard(BREATHING, 'observed');
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly?.textContent).toContain('36');
  });

  it('計数UIは実測モードのみ表示する', () => {
    renderCard(BREATHING, 'observed');
    expect(screen.getByRole('button', { name: '呼吸を数える' })).toBeInTheDocument();

    renderCard(BREATHING, 'numeric');
    // 数値モードのカードを足しても計数ボタンは増えない
    expect(screen.getAllByRole('button', { name: '呼吸を数える' })).toHaveLength(1);
  });
});

describe('prefers-reduced-motion のフォールバック（docs/OBSERVATION.md §3.5）', () => {
  it('実測モードでも数値を表示し、その旨を画面に出す', () => {
    stubMatchMedia(true);
    wrap(<VitalsBar case={BREATHING} presentation="observed" measuredCrt={null} onCrtMeasured={() => undefined} onBreathCounted={() => undefined} onPulseCounted={() => undefined} />);

    expect(screen.getByText('36 回/分')).toBeInTheDocument();
    expect(screen.getByText(/動きを減らす設定が有効なため/)).toBeInTheDocument();
  });

  it('数値モードではフォールバックの通知を出さない', () => {
    stubMatchMedia(true);
    wrap(<VitalsBar case={BREATHING} presentation="numeric" measuredCrt={null} onCrtMeasured={() => undefined} onBreathCounted={() => undefined} onPulseCounted={() => undefined} />);
    expect(screen.queryByText(/動きを減らす設定が有効なため/)).not.toBeInTheDocument();
  });
});

describe('タップ計数は回答の前提条件ではない', () => {
  it('一度も数えずに区分を回答できる', async () => {
    const user = userEvent.setup();
    patchSettings({ vitalsPresentation: 'observed' });
    wrap(<LearnMode />);

    const button = screen.getByRole('button', { name: 'I類・緊急治療群' });
    expect(button).toBeEnabled();
    await user.click(button);

    // 回答が受け付けられ、解説シートに結果が出る
    expect(screen.getByText(/^[○×]/)).toBeInTheDocument();
  });

  it('数えなかった場合は実際の呼吸数を解説で示す', () => {
    // LearnMode 経由だと症例がランダムで、無呼吸を引くと計数対象がなくなる。
    // 計数フィードバックの内容は決定的な症例で直接検証する
    wrap(<CountFeedback case={BREATHING} count={EMPTY_COUNT} profile={JP_FDMA} />);
    expect(screen.getByText(/呼吸数は数えませんでした/)).toBeInTheDocument();
    expect(screen.getByText(/36/)).toBeInTheDocument();
  });

  it('評価されなかった項目のフィードバックは出さない', () => {
    // 無呼吸の症例は気道確保で確定する。呼吸数もCRTも評価されていない
    const { container } = wrap(<CountFeedback case={APNEIC} count={EMPTY_COUNT} profile={JP_FDMA} />);
    expect(container.textContent).toBe('');
  });

  it('測った項目は評価外でも結果を返す', () => {
    wrap(<CountFeedback case={APNEIC} count={EMPTY_COUNT} profile={JP_FDMA} measuredCrt={2.4} />);
    expect(screen.getByText(/CRT/)).toBeInTheDocument();
  });

  it('歩行可能な症例では呼吸数のフィードバックを出さない', () => {
    const walkable = { ...BREATHING, canWalk: true, respiratoryRate: 18 };
    const { container } = wrap(<CountFeedback case={walkable} count={EMPTY_COUNT} profile={JP_FDMA} />);
    expect(container.textContent).toBe('');
  });
});

describe('学習モードの基本動作（SPEC §2.3）', () => {
  it('回答すると解説シートに結果と次へが出る', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    expect(screen.queryByRole('button', { name: '次の症例' })).not.toBeInTheDocument();

    await answer(user, 'III類・軽処置群');

    expect(screen.getByRole('list', { name: '判定の根拠' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '次の症例' }).length).toBeGreaterThan(0);
  });

  it('回答後は区分ボタンが消えて二重回答できない', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await answer(user, 'III類・軽処置群');
    expect(screen.queryByRole('button', { name: 'I類・緊急治療群' })).not.toBeInTheDocument();
  });

  it('判定フローが5ステップすべてを順序どおり示す', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await answer(user, 'III類・軽処置群');

    const flow = screen.getByRole('list', { name: '判定の根拠' });
    const steps = [...flow.children].filter((el) => el.tagName === 'LI');
    expect(steps).toHaveLength(5);
    expect(steps[0]?.textContent).toContain('歩行');
  });

  it('判定が確定したステップがちょうど1つ示される', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await answer(user, 'III類・軽処置群');
    expect(screen.getAllByText('ここで確定')).toHaveLength(1);
  });

  it('解説を閉じても回答バーから再表示できる', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await answer(user, 'III類・軽処置群');
    expect(screen.getByRole('list', { name: '判定の根拠' })).toBeInTheDocument();

    // ブラウザは開いている modal dialog 上の Esc を cancel イベントにする。
    // jsdom はこの対応付けを持たないため、同じイベントを直接発火させる
    const dialog = screen.getByRole('list', { name: '判定の根拠' }).closest('dialog') as HTMLDialogElement;
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('list', { name: '判定の根拠' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '解説を見る' }));
    expect(screen.getByRole('list', { name: '判定の根拠' })).toBeInTheDocument();
  });

  it('次の症例へ進むと回答状態がリセットされる', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await answer(user, 'III類・軽処置群');
    await user.click(screen.getAllByRole('button', { name: '次の症例' })[0] as HTMLElement);

    expect(screen.queryByRole('button', { name: '次の症例' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I類・緊急治療群' })).toBeEnabled();
  });

  it('統計が localStorage に永続化される', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await answer(user, 'III類・軽処置群');

    const stored = JSON.parse(localStorage.getItem('triage-start:v1') as string) as {
      learnStats: { answered: number };
    };
    expect(stored.learnStats.answered).toBe(1);
  });

  it('複数問の統計が累計される', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await answer(user, 'III類・軽処置群');
    await user.click(screen.getAllByRole('button', { name: '次の症例' })[0] as HTMLElement);
    await answer(user, 'III類・軽処置群');

    const stored = JSON.parse(localStorage.getItem('triage-start:v1') as string) as {
      learnStats: { answered: number };
    };
    expect(stored.learnStats.answered).toBe(2);
  });
});

describe('キーボード操作（SPEC §5.2）', () => {
  it('1 / 2 / 3 / 0 で回答できる', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await user.keyboard('3');
    expect(screen.getAllByRole('button', { name: '次の症例' }).length).toBeGreaterThan(0);
  });

  it('回答後は数字キーで二重回答できない', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await user.keyboard('3');
    await user.keyboard('1');

    const stored = JSON.parse(localStorage.getItem('triage-start:v1') as string) as {
      learnStats: { answered: number };
    };
    expect(stored.learnStats.answered).toBe(1);
  });
});

describe('アクセシビリティ', () => {
  it('区分ボタンは色だけに依存しない（ローマ数字＋和文＋aria-label）', () => {
    wrap(<LearnMode />);

    const button = screen.getByRole('button', { name: 'I類・緊急治療群' });
    expect(button.textContent).toContain('I');
    expect(button.textContent).toContain('緊急');
  });

  it('数値モードのバイタルが定義リストとして読み上げ可能', () => {
    const { container } = renderCard(BREATHING, 'numeric');
    expect(container.querySelector('dl')).toBeTruthy();
    // 呼吸数・CRT・橈骨動脈の3項目
    expect(container.querySelectorAll('dt')).toHaveLength(3);
    expect(container.querySelectorAll('dd')).toHaveLength(3);
  });

  it('実測モードでも真の値が定義リストで支援技術に渡る', () => {
    const { container } = renderCard(BREATHING, 'observed');
    const srOnly = container.querySelector('dl.sr-only');
    expect(srOnly).toBeTruthy();
    expect(srOnly?.querySelectorAll('dt')).toHaveLength(3);
    expect(srOnly?.textContent).toContain('36');
  });

  it('確定したステップが aria-current で示される', async () => {
    const user = userEvent.setup();
    wrap(<LearnMode />);

    await answer(user, 'III類・軽処置群');
    const flow = screen.getByRole('list', { name: '判定の根拠' });
    const current = [...flow.children].filter((el) => el.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
  });
});
