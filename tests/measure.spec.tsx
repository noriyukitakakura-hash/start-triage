import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrtMeasure } from '@/components/CrtMeasure';
import { PulseMeasure } from '@/components/PulseMeasure';
import { AnalogClock } from '@/components/AnalogClock';
import { CaseCard } from '@/components/CaseCard';
import { SettingsProvider } from '@/app/SettingsProvider';
import { I18nProvider } from '@/i18n';
import { CRT_PRESS_SECONDS } from '@/domain/circulation';
import { EMPTY_COUNT, computeCount } from '@/domain/tapCounting';
import type { TriageCase } from '@/domain/types';

const PALPABLE: TriageCase = {
  id: 'measure-test',
  patient: { illustrationId: 'supine-still', situationKey: 'situation.lyingStill' },
  canWalk: false,
  hasSpontaneousBreathing: true,
  breathingAfterAirway: null,
  respiratoryRate: 18,
  radialPulsePalpable: true,
  pulseRate: 120,
  crtSeconds: 2.8,
  obeysCommands: true,
};

const NOT_PALPABLE: TriageCase = {
  ...PALPABLE,
  id: 'measure-test-absent',
  radialPulsePalpable: false,
  pulseRate: null,
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

function wrap(node: React.ReactNode) {
  return render(
    <I18nProvider>
      <SettingsProvider>{node}</SettingsProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/?lang=ja');
  stubMatchMedia(false);
});

describe('CRT: 圧迫時間が手技として要求される（docs/OBSERVATION.md）', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

  /** 爪を押して離すまでを指定ミリ秒で再現する */
  async function pressNail(ms: number) {
    const nail = screen.getByRole('button', { name: '爪を押す' });
    fireEvent.pointerDown(nail);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
    fireEvent.pointerUp(nail);
  }

  it(`${CRT_PRESS_SECONDS}秒未満で離すと測定が成立せず、やり直しを促す`, async () => {
    const onMeasured = vi.fn();
    wrap(<CrtMeasure case={PALPABLE} onMeasured={onMeasured} measured={null} />);

    await pressNail(2000);

    expect(screen.getByText(/秒間押し続けてください/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '色が戻った' })).not.toBeInTheDocument();
    expect(onMeasured).not.toHaveBeenCalled();
  });

  it(`${CRT_PRESS_SECONDS}秒押し続けると計測に進める`, async () => {
    wrap(<CrtMeasure case={PALPABLE} onMeasured={vi.fn()} measured={null} />);

    await pressNail(CRT_PRESS_SECONDS * 1000 + 100);

    expect(screen.queryByText(/秒間押し続けてください/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '色が戻った' })).toBeInTheDocument();
  });

  it('離してから申告するまでの時間が測定値になる', async () => {
    const onMeasured = vi.fn();
    wrap(<CrtMeasure case={PALPABLE} onMeasured={onMeasured} measured={null} />);

    await pressNail(CRT_PRESS_SECONDS * 1000 + 100);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    fireEvent.click(screen.getByRole('button', { name: '色が戻った' }));

    expect(onMeasured).toHaveBeenCalledTimes(1);
    expect(onMeasured.mock.calls[0]?.[0]).toBeCloseTo(2.5, 1);
  });

  it('押下中は残り時間が示される', async () => {
    wrap(<CrtMeasure case={PALPABLE} onMeasured={vi.fn()} measured={null} />);

    const nail = screen.getByRole('button', { name: '爪を押す' });
    fireEvent.pointerDown(nail);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(screen.getByText(/押し続けてください/)).toBeInTheDocument();
    fireEvent.pointerUp(nail);
  });

  it('爪床の色が戻る速さに症例のCRTが使われる', async () => {
    const { container } = wrap(<CrtMeasure case={PALPABLE} onMeasured={vi.fn()} measured={null} />);

    await pressNail(CRT_PRESS_SECONDS * 1000 + 100);

    const nail = container.querySelector('.crt-nail') as SVGElement;
    expect(nail.getAttribute('style')).toContain('2.8s');
  });

  it('押している間は爪床が白くなる', () => {
    const { container } = wrap(<CrtMeasure case={PALPABLE} onMeasured={vi.fn()} measured={null} />);

    const nail = container.querySelector('.crt-nail') as SVGElement;
    expect(nail.getAttribute('class')).not.toContain('blanched');

    act(() => {
      fireEvent.pointerDown(screen.getByRole('button', { name: '爪を押す' }));
    });
    expect(nail.getAttribute('class')).toContain('blanched');
  });
});

describe('脈拍: 触知可否が手がかりになる', () => {
  it('触知不能の症例では拍動を一切描画しない（静止が手がかり）', () => {
    const { container } = wrap(
      <PulseMeasure case={NOT_PALPABLE} onCounted={vi.fn()} count={EMPTY_COUNT} />,
    );

    const point = container.querySelector('.pulse-point');
    expect(point).toBeNull();
    expect(screen.getByText('拍動を触れません')).toBeInTheDocument();
  });

  it('触知不能ではタップ計数を出さない（数える対象がない）', () => {
    wrap(<PulseMeasure case={NOT_PALPABLE} onCounted={vi.fn()} count={EMPTY_COUNT} />);
    expect(screen.queryByRole('button', { name: '脈を数える' })).not.toBeInTheDocument();
  });

  it('触知可なら脈拍どおりの周期で拍動する', () => {
    const { container } = wrap(
      <PulseMeasure case={PALPABLE} onCounted={vi.fn()} count={EMPTY_COUNT} />,
    );

    const point = container.querySelector('.pulse-point') as SVGElement;
    // 脈拍120 → 0.5秒周期
    expect(point.getAttribute('style')).toContain('animation-duration: 0.5s');
    expect(screen.getByText('拍動を触れます')).toBeInTheDocument();
  });

  it('タップすると計数が親へ渡る', async () => {
    const user = userEvent.setup();
    const onCounted = vi.fn();
    wrap(<PulseMeasure case={PALPABLE} onCounted={onCounted} count={EMPTY_COUNT} />);

    await user.click(screen.getByRole('button', { name: '脈を数える' }));
    expect(onCounted).toHaveBeenCalledTimes(1);
  });

  it('計数の数理が呼吸と共通である', () => {
    // 脈拍120を等間隔に5回タップ = 4間隔 = 2秒... 信頼できる長さに達するまでは null
    expect(computeCount([0, 500, 1000, 1500, 2000]).estimatedRate).toBeNull();
    expect(computeCount([0, 500, 1000, 1500, 2000, 2500, 3000, 3500]).estimatedRate).toBe(120);
  });

  it('prefers-reduced-motion では拍動を動かさない', () => {
    stubMatchMedia(true);
    const { container } = wrap(
      <PulseMeasure case={PALPABLE} onCounted={vi.fn()} count={EMPTY_COUNT} />,
    );
    expect(container.querySelector('.pulse-point')).toBeNull();
  });
});

describe('アナログ時計（SPEC §2.4）', () => {
  it('秒針と分針が経過時間に応じて回る', () => {
    const { container } = wrap(<AnalogClock elapsedMs={15_000} />);
    const lines = [...container.querySelectorAll('line')];
    const rotations = lines.map((l) => l.getAttribute('transform')).filter((v) => v !== null);
    // 15秒 → 秒針90度
    expect(rotations.some((r) => r.includes('rotate(90'))).toBe(true);
  });

  it('視覚だけに依存しないよう数値を併記する', () => {
    const { container } = wrap(<AnalogClock elapsedMs={83_450} />);
    expect(container.querySelector('.sr-only')?.textContent).toBe('1分23.45秒');
  });

  it('prefers-reduced-motion では数値表示にする', () => {
    stubMatchMedia(true);
    const { container } = wrap(<AnalogClock elapsedMs={83_450} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('1分23.45秒')).toBeInTheDocument();
  });
});

describe('計測は回答の前提条件ではない', () => {
  it('実測モードでもCRT・脈拍は未測定のまま表示される', () => {
    wrap(<CaseCard case={PALPABLE} presentation="observed" />);

    expect(screen.getByText('未測定')).toBeInTheDocument();
    expect(screen.getByText('触知する')).toBeInTheDocument();
  });

  it('計測UIはシートの中にしか存在しない（SPEC §5.1）', async () => {
    const user = userEvent.setup();
    const { container } = wrap(<CaseCard case={PALPABLE} presentation="observed" />);

    expect(container.querySelector('.crt-finger')).toBeNull();

    await user.click(screen.getByText('未測定'));
    const finger = container.querySelector('.crt-finger');
    expect(finger).not.toBeNull();
    expect(finger?.closest('dialog')).not.toBeNull();
  });

  it('数値モードでは計測ボタンを出さず数値を表示する', () => {
    wrap(<CaseCard case={PALPABLE} presentation="numeric" />);

    expect(screen.queryByText('未測定')).not.toBeInTheDocument();
    expect(screen.getByText('2.8 秒')).toBeInTheDocument();
    expect(screen.getByText('120 回/分')).toBeInTheDocument();
  });
});
