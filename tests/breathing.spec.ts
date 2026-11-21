import { describe, expect, it } from 'vitest';
import {
  AGONAL_MAX_RATE,
  BREATHING_PATTERNS,
  GASPS_PER_LOOP,
  MIN_ESTIMATE_MS,
  RAPID_MIN_RATE,
  agonalLoopSeconds,
  breathCycleSeconds,
  breathingPatternOf,
  estimateRate,
  expectedBreathCount,
  isEstimateReliable,
  type BreathingPattern,
} from '@/domain/breathing';
import { VALID_COMBINATIONS, generateCase } from '@/domain/generator';
import { createRng } from '@/domain/rng';
import type { TriageCase } from '@/domain/types';

const BASE: TriageCase = {
  id: 'breathing-test',
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

const make = (o: Partial<TriageCase>): TriageCase => ({ ...BASE, ...o });

describe('breathingPatternOf', () => {
  it('自発呼吸がなければ apneic', () => {
    expect(
      breathingPatternOf(
        make({ hasSpontaneousBreathing: false, breathingAfterAirway: false, respiratoryRate: 0 }),
      ),
    ).toBe('apneic');
  });

  const cases: [rr: number, expected: BreathingPattern][] = [
    [4, 'agonal'],
    [5, 'agonal'],
    [9, 'agonal'],
    [10, 'normal'],
    [18, 'normal'],
    [29, 'normal'],
    [30, 'rapidShallow'],
    [44, 'rapidShallow'],
  ];

  it.each(cases)('呼吸数 %i → %s', (rr, expected) => {
    expect(breathingPatternOf(make({ respiratoryRate: rr }))).toBe(expected);
  });

  it('境界は 9/10 と 29/30', () => {
    expect(breathingPatternOf(make({ respiratoryRate: AGONAL_MAX_RATE }))).toBe('agonal');
    expect(breathingPatternOf(make({ respiratoryRate: AGONAL_MAX_RATE + 1 }))).toBe('normal');
    expect(breathingPatternOf(make({ respiratoryRate: RAPID_MIN_RATE - 1 }))).toBe('normal');
    expect(breathingPatternOf(make({ respiratoryRate: RAPID_MIN_RATE }))).toBe('rapidShallow');
  });

  it('生成したあらゆる症例に対して定義済みのパターンを返す', () => {
    const rng = createRng('pattern-coverage');
    const seen = new Set<BreathingPattern>();
    for (let i = 0; i < 3000; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const p = breathingPatternOf(
        generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng).case,
      );
      expect(BREATHING_PATTERNS).toContain(p);
      seen.add(p);
    }
    // 4パターンすべてが実際に生成される
    expect([...seen].sort()).toEqual(['agonal', 'apneic', 'normal', 'rapidShallow']);
  });
});

describe('breathCycleSeconds', () => {
  it('呼吸数から正確な周期を返す', () => {
    expect(breathCycleSeconds(30)).toBe(2);
    expect(breathCycleSeconds(60)).toBe(1);
    expect(breathCycleSeconds(4)).toBe(15);
    expect(breathCycleSeconds(20)).toBe(3);
  });

  it('周期×呼吸数が常に60秒になる（アニメーションが毎分 rr 回を厳密に満たす）', () => {
    for (let rr = 1; rr <= 60; rr++) {
      expect(breathCycleSeconds(rr) * rr).toBeCloseTo(60, 10);
    }
  });

  it('呼吸数0以下は周期を持たない', () => {
    expect(() => breathCycleSeconds(0)).toThrow();
    expect(() => breathCycleSeconds(-1)).toThrow();
  });
});

describe('agonalLoopSeconds: 不規則化しても平均レートを保つ', () => {
  it('ループ長は 1ループの呼吸数 × 周期', () => {
    expect(agonalLoopSeconds(6)).toBe(GASPS_PER_LOOP * 10);
    expect(agonalLoopSeconds(4)).toBe(GASPS_PER_LOOP * 15);
  });

  it('ループ内の呼吸数 ÷ ループ秒数 × 60 が呼吸数と厳密に一致する', () => {
    for (let rr = 1; rr <= AGONAL_MAX_RATE; rr++) {
      const rate = (GASPS_PER_LOOP / agonalLoopSeconds(rr)) * 60;
      expect(rate).toBeCloseTo(rr, 10);
    }
  });
});

describe('expectedBreathCount', () => {
  it('経過時間に対する呼吸回数を返す', () => {
    expect(expectedBreathCount(30, 60_000)).toBe(30);
    expect(expectedBreathCount(30, 15_000)).toBe(7.5);
    expect(expectedBreathCount(34, 15_000)).toBeCloseTo(8.5, 10);
    expect(expectedBreathCount(5, 15_000)).toBeCloseTo(1.25, 10);
  });

  it('呼吸数に対して単調増加する', () => {
    let prev = -1;
    for (let rr = 1; rr <= 44; rr++) {
      const n = expectedBreathCount(rr, 15_000);
      expect(n).toBeGreaterThan(prev);
      prev = n;
    }
  });

  it('経過時間に対して単調増加する', () => {
    let prev = -1;
    for (let ms = 0; ms <= 60_000; ms += 500) {
      const n = expectedBreathCount(20, ms);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });

  it('経過0なら0回、無呼吸なら常に0回', () => {
    expect(expectedBreathCount(20, 0)).toBe(0);
    expect(expectedBreathCount(0, 60_000)).toBe(0);
  });

  it('負の経過時間はエラー', () => {
    expect(() => expectedBreathCount(20, -1)).toThrow();
  });
});

describe('estimateRate: タップ計数からの毎分換算', () => {
  it('タップ7回・12.4秒で約34回/分', () => {
    expect(estimateRate(7, 12_400)).toBe(34);
  });

  it('15秒の観察で3帯が分離する（実測モードの前提）', () => {
    // 該当下限 5回/分 → 15秒で1回、通過 14〜25回/分 → 3〜6回、該当上限 34回/分 → 8〜9回
    expect(estimateRate(1, 15_000)).toBe(4);
    expect(estimateRate(3, 15_000)).toBe(12);
    expect(estimateRate(6, 15_000)).toBe(24);
    expect(estimateRate(9, 15_000)).toBe(36);
  });

  it('真の呼吸数どおりにタップすれば推定値が一致する', () => {
    for (const rr of [14, 18, 25, 34, 40]) {
      const elapsedMs = 30_000;
      const taps = expectedBreathCount(rr, elapsedMs);
      expect(estimateRate(taps, elapsedMs)).toBe(rr);
    }
  });

  it('経過0なら0を返す（0除算しない）', () => {
    expect(estimateRate(5, 0)).toBe(0);
    expect(estimateRate(0, 0)).toBe(0);
  });

  it('負のタップ数はエラー', () => {
    expect(() => estimateRate(-1, 1000)).toThrow();
  });
});

describe('isEstimateReliable', () => {
  it('観察が短すぎる間は推定値を信頼しない', () => {
    expect(isEstimateReliable(0)).toBe(false);
    expect(isEstimateReliable(MIN_ESTIMATE_MS - 1)).toBe(false);
    expect(isEstimateReliable(MIN_ESTIMATE_MS)).toBe(true);
    expect(isEstimateReliable(15_000)).toBe(true);
  });
});
