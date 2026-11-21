import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrtInstrument } from '@/components/vitals/CrtInstrument';
import { PulseInstrument } from '@/components/vitals/PulseInstrument';
import { AnalogClock } from '@/components/AnalogClock';
import { CaseCard } from '@/components/CaseCard';
import { SettingsProvider } from '@/app/SettingsProvider';
import { I18nProvider } from '@/i18n';
import { CRT_PRESS_SECONDS } from '@/domain/circulation';
import { computeCount } from '@/domain/tapCounting';
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
  nonObeyingResponse: null,
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
    wrap(<CrtInstrument case={PALPABLE} onMeasured={onMeasured} measured={null} />);

    await pressNail(2000);

    expect(screen.getByText(/秒押す/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '色が戻った' })).not.toBeInTheDocument();
    expect(onMeasured).not.toHaveBeenCalled();
  });

  it(`${CRT_PRESS_SECONDS}秒押し続けると計測に進める`, async () => {
    wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);

    await pressNail(CRT_PRESS_SECONDS * 1000 + 100);

    expect(screen.queryByText(/秒押す/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '色が戻った' })).toBeInTheDocument();
  });

  it('離してから申告するまでの時間が測定値になる', async () => {
    const onMeasured = vi.fn();
    wrap(<CrtInstrument case={PALPABLE} onMeasured={onMeasured} measured={null} />);

    await pressNail(CRT_PRESS_SECONDS * 1000 + 100);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    fireEvent.click(screen.getByRole('button', { name: '色が戻った' }));

    expect(onMeasured).toHaveBeenCalledTimes(1);
    expect(onMeasured.mock.calls[0]?.[0]).toBeCloseTo(2.5, 1);
  });

  it('押下中は残り時間が示される', async () => {
    wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);

    const nail = screen.getByRole('button', { name: '爪を押す' });
    fireEvent.pointerDown(nail);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(screen.getByText(/残り/)).toBeInTheDocument();
    fireEvent.pointerUp(nail);
  });

  it('押下中の残り時間はセルの外（上）に出る', async () => {
    // スマートフォンでは押している指とその付け根が読み取り欄を覆ってしまう。
    // 指は接触点より下に伸びるため、上へ逃がすほかない
    const { container } = wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);

    const nail = screen.getByRole('button', { name: '爪を押す' });
    fireEvent.pointerDown(nail);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    const readout = container.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(readout.textContent).toMatch(/残り/);
    expect(readout.className, 'セルの上辺より外へ出していない').toContain('bottom-full');
    expect(readout.className).toContain('absolute');
    // 読み取りであって操作ではない。下の声かけボタンへのタップを奪ってはいけない
    expect(readout.className).toContain('pointer-events-none');

    fireEvent.pointerUp(nail);
  });

  it('残り時間を外に出しても読み上げ領域は作り直さない', async () => {
    // 要素ごと差し替えると live region が再生成され、読み上げが落ちることがある
    const { container } = wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);
    const before = container.querySelector('[aria-live="polite"]');

    const nail = screen.getByRole('button', { name: '爪を押す' });
    fireEvent.pointerDown(nail);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(container.querySelector('[aria-live="polite"]')).toBe(before);
    fireEvent.pointerUp(nail);
  });

  it('押していないときは読み取り欄に収まる（セルの高さを変えない）', () => {
    const { container } = wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);
    const readout = container.querySelector('[aria-live="polite"]') as HTMLElement;

    expect(readout.className).not.toContain('absolute');
  });

  it('爪床の色が戻る速さに症例のCRTが使われる', async () => {
    const { container } = wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);

    await pressNail(CRT_PRESS_SECONDS * 1000 + 100);

    const nail = container.querySelector('.crt-nail') as SVGElement;
    expect(nail.getAttribute('style')).toContain('2.8s');
  });

  it('離すと白が解除され、色が元へ戻り始める', async () => {
    const { container } = wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);
    const nail = container.querySelector('.crt-nail') as SVGElement;

    await pressNail(CRT_PRESS_SECONDS * 1000 + 100);

    // 白の指定が外れていなければ fill の行き先が変わらず、色は永久に戻らない
    expect(nail.getAttribute('class')).not.toContain('blanched');
    // 戻る速さは症例の値
    expect(nail.getAttribute('style')).toContain('2.8s');
  });

  it('圧迫不足でやり直しになったときも白は残らない', async () => {
    const { container } = wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);
    const nail = container.querySelector('.crt-nail') as SVGElement;

    await pressNail(2000);

    expect(nail.getAttribute('class')).not.toContain('blanched');
  });

  it('申告後も白は残らない', async () => {
    const { container } = wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);
    const nail = container.querySelector('.crt-nail') as SVGElement;

    await pressNail(CRT_PRESS_SECONDS * 1000 + 100);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2800);
    });
    fireEvent.click(screen.getByRole('button', { name: '色が戻った' }));

    expect(nail.getAttribute('class')).not.toContain('blanched');
  });

  it('白くなるのは圧迫中の一局面だけである', async () => {
    const { container } = wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);
    const nail = container.querySelector('.crt-nail') as SVGElement;
    const isBlanched = () => (nail.getAttribute('class') ?? '').includes('blanched');

    expect(isBlanched(), '押す前').toBe(false);

    const target = screen.getByRole('button', { name: '爪を押す' });
    act(() => {
      fireEvent.pointerDown(target);
    });
    expect(isBlanched(), '圧迫中').toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CRT_PRESS_SECONDS * 1000 + 100);
    });
    act(() => {
      fireEvent.pointerUp(target);
    });
    expect(isBlanched(), '離した直後').toBe(false);
  });

  it('押している間は爪床が白くなる', () => {
    const { container } = wrap(<CrtInstrument case={PALPABLE} onMeasured={vi.fn()} measured={null} />);

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
      <PulseInstrument case={NOT_PALPABLE} onCounted={vi.fn()} />,
    );

    const point = container.querySelector('.pulse-point');
    expect(point).toBeNull();
    expect(screen.getByText('触れない')).toBeInTheDocument();
  });

  it('触知不能ではタップ計数を出さない（数える対象がない）', () => {
    wrap(<PulseInstrument case={NOT_PALPABLE} onCounted={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '脈を数える' })).not.toBeInTheDocument();
  });

  it('触知可なら脈拍どおりの周期で拍動する', () => {
    const { container } = wrap(
      <PulseInstrument case={PALPABLE} onCounted={vi.fn()} />,
    );

    const point = container.querySelector('.pulse-point') as SVGElement;
    // 脈拍120 → 0.5秒周期
    expect(point.getAttribute('style')).toContain('animation-duration: 0.5s');
    
  });

  it('タップすると計数が親へ渡る', async () => {
    const user = userEvent.setup();
    const onCounted = vi.fn();
    wrap(<PulseInstrument case={PALPABLE} onCounted={onCounted} />);

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
      <PulseInstrument case={PALPABLE} onCounted={vi.fn()} />,
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

describe('計測器を常時表示する（SPEC §5.1）', () => {
  it('ダイアログを開かずに爪床と触知点が見える', () => {
    const { container } = wrap(<CaseCard case={PALPABLE} presentation="observed" />);

    expect(container.querySelector('.crt-nail')).not.toBeNull();
    expect(container.querySelector('.pulse-point')).not.toBeNull();
  });

  it('計測UIがダイアログの中に存在しない', () => {
    const { container } = wrap(<CaseCard case={PALPABLE} presentation="observed" />);

    expect(container.querySelector('.crt-nail')?.closest('dialog')).toBeNull();
    expect(container.querySelector('.pulse-point')?.closest('dialog')).toBeNull();
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('3つの計測器が同時に存在する', () => {
    wrap(<CaseCard case={PALPABLE} presentation="observed" />);

    expect(screen.getByRole('button', { name: '呼吸を数える' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '爪を押す' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '脈を数える' })).toBeInTheDocument();
  });

  it('計測しなくても区分を回答できる（前提条件ではない）', () => {
    const { container } = wrap(<CaseCard case={PALPABLE} presentation="observed" />);
    // 未測定でも読み取り欄が空くだけで、操作を妨げない
    expect(container.textContent).toContain('—');
  });
});

describe('数値モードは同じ枠に数値を入れる', () => {
  it('計測ボタンを出さず数値を表示する', () => {
    wrap(<CaseCard case={PALPABLE} presentation="numeric" />);

    expect(screen.queryByRole('button', { name: '爪を押す' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '脈を数える' })).not.toBeInTheDocument();
    expect(screen.getByText('2.8 秒')).toBeInTheDocument();
    expect(screen.getByText('120 回/分')).toBeInTheDocument();
    expect(screen.getByText('18 回/分')).toBeInTheDocument();
  });

  it('実測モードと枠の構造（セル数・並び）が一致する', () => {
    const observed = wrap(<CaseCard case={PALPABLE} presentation="observed" />);
    const observedCells = observed.container.querySelectorAll('.grid-cols-3 > *').length;
    observed.unmount();

    const numeric = wrap(<CaseCard case={PALPABLE} presentation="numeric" />);
    const numericCells = numeric.container.querySelectorAll('.grid-cols-3 > *').length;

    expect(observedCells).toBe(3);
    expect(numericCells).toBe(3);
  });
});
