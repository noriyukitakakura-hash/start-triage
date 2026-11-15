import { describe, expect, it } from 'vitest';
import { MIN_TAPS_FOR_ESTIMATE, computeCount } from '@/components/BreathCounter';
import { MIN_ESTIMATE_MS } from '@/domain/breathing';

/** 呼吸数 rr で等間隔に n 回タップした時刻列 */
function evenTaps(rr: number, n: number, startMs = 1000): number[] {
  const interval = 60_000 / rr;
  return Array.from({ length: n }, (_, i) => startMs + i * interval);
}

describe('computeCount: 間隔から毎分換算する', () => {
  it('N回のタップは N-1 個の間隔を張る（1回多く数えない）', () => {
    // 呼吸数30 → 2秒間隔。5回タップ = 4間隔 = 8秒
    const taps = evenTaps(30, 5);
    const result = computeCount(taps);
    expect(result.taps).toBe(5);
    expect(result.spanMs).toBe(8000);
    expect(result.estimatedRate).toBe(30);
  });

  it('真の呼吸数どおりにタップすれば推定値が一致する', () => {
    for (const rr of [5, 14, 18, 25, 34, 44]) {
      const result = computeCount(evenTaps(rr, 8));
      expect(result.estimatedRate, `rr=${rr}`).toBe(rr);
    }
  });

  it('1回分多く数えると推定値が上振れする（柵と杭の数え間違いを検出できる）', () => {
    const correct = computeCount(evenTaps(30, 5)).estimatedRate;
    // 同じ8秒の間に6回タップしてしまった場合
    const over = computeCount([1000, 2600, 4200, 5800, 7400, 9000]).estimatedRate;
    expect(correct).toBe(30);
    expect(over).toBeGreaterThan(30);
  });
});

describe('computeCount: 経過時間はタップ間で決まる', () => {
  it('最初のタップ以前の時間は経過に含めない', () => {
    // 症例表示から長く経ってから数え始めても経過は変わらない
    const early = computeCount(evenTaps(20, 4, 1000));
    const late = computeCount(evenTaps(20, 4, 60_000));
    expect(early.spanMs).toBe(late.spanMs);
    expect(early.estimatedRate).toBe(late.estimatedRate);
  });

  it('タップを止めれば経過も推定値も動かない', () => {
    const taps = evenTaps(20, 5);
    const first = computeCount(taps);
    // 判断に迷っている間に時間が経っても、タップ列が同じなら結果は同じ
    const later = computeCount(taps);
    expect(later).toEqual(first);
  });
});

describe('computeCount: 推定値を出す条件', () => {
  it('タップ0回・1回では推定しない', () => {
    expect(computeCount([]).estimatedRate).toBeNull();
    expect(computeCount([1000]).estimatedRate).toBeNull();
  });

  it(`タップが${MIN_TAPS_FOR_ESTIMATE}回未満なら推定しない`, () => {
    // 2回でも間隔は張るが、ばらつきが大きいため出さない
    const result = computeCount([1000, 1000 + MIN_ESTIMATE_MS + 1000]);
    expect(result.taps).toBe(2);
    expect(result.spanMs).toBeGreaterThan(MIN_ESTIMATE_MS);
    expect(result.estimatedRate).toBeNull();
  });

  it(`観察が${MIN_ESTIMATE_MS}ms 未満なら推定しない`, () => {
    // 速く3回タップしても、短すぎる観察では過大な値になる
    const result = computeCount([1000, 1200, 1400]);
    expect(result.taps).toBe(3);
    expect(result.spanMs).toBeLessThan(MIN_ESTIMATE_MS);
    expect(result.estimatedRate).toBeNull();
  });

  it('条件を満たせば推定値を出す', () => {
    const result = computeCount([1000, 2500, 4000, 5500]);
    expect(result.taps).toBe(4);
    expect(result.spanMs).toBe(4500);
    expect(result.estimatedRate).toBe(40);
  });
});

describe('computeCount: 実測モードの3帯が判別できる', () => {
  it('15秒の観察で該当下限・通過・該当上限が分離する', () => {
    // 呼吸数5（I類）: 15秒で2回タップでは推定不可。長めに観察する
    expect(computeCount(evenTaps(5, 4)).estimatedRate).toBe(5);
    // 通過域
    expect(computeCount(evenTaps(14, 5)).estimatedRate).toBe(14);
    expect(computeCount(evenTaps(25, 7)).estimatedRate).toBe(25);
    // 該当上限
    expect(computeCount(evenTaps(34, 9)).estimatedRate).toBe(34);
  });

  it('1回数え間違えても帯をまたがない', () => {
    // 呼吸数34を9回タップすべきところ8回で数えた場合
    const taps = evenTaps(34, 9);
    const short = computeCount(taps.slice(0, 8)).estimatedRate as number;
    // 30回以上という判断は維持される
    expect(short).toBeGreaterThanOrEqual(30);
  });
});
