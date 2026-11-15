import { describe, expect, it } from 'vitest';
import { judge } from '@/domain/judge';
import {
  DEFAULT_BOUNDARY_RATE,
  ImpossibleCombinationError,
  VALID_COMBINATIONS,
  decidingStepsFor,
  generateCase,
  type GeneratedCase,
} from '@/domain/generator';
import { JP_FDMA, US_START } from '@/domain/profiles';
import { ILLUSTRATIONS } from '@/domain/illustrations';
import { createRng } from '@/domain/rng';
import { CATEGORIES, DECIDING_STEPS, type Category, type DecidingStep } from '@/domain/types';

const ITERATIONS = 10_000;

/** 症例そのものの矛盾を検査する（SPEC §3.3 整合性制約） */
function assertInternallyConsistent(g: GeneratedCase): void {
  const c = g.case;
  const where = `${g.target}/${g.decidingStep}/${c.id}`;

  // イラストと歩行可否が一致する
  const illustration = ILLUSTRATIONS.find((i) => i.id === c.patient.illustrationId);
  expect(illustration, `${where}: 未知のイラストID ${c.patient.illustrationId}`).toBeDefined();
  expect(illustration?.canWalk, `${where}: イラストと canWalk が矛盾`).toBe(c.canWalk);
  expect(illustration?.situationKey, `${where}: 状況文キーが不一致`).toBe(c.patient.situationKey);

  // 自発呼吸と呼吸数・気道確保の整合
  if (c.hasSpontaneousBreathing) {
    expect(c.breathingAfterAirway, `${where}: 呼吸ありなら気道確保の結果は持たない`).toBeNull();
    expect(c.respiratoryRate, `${where}: 呼吸ありなら呼吸数は null でない`).not.toBeNull();
    expect(c.respiratoryRate as number, `${where}: 呼吸ありなら呼吸数は 1 以上`).toBeGreaterThanOrEqual(1);
  } else {
    expect(c.breathingAfterAirway, `${where}: 呼吸なしなら気道確保の結果を持つ`).not.toBeNull();
    expect(c.respiratoryRate, `${where}: 呼吸なしなら呼吸数は 0`).toBe(0);
    expect(c.obeysCommands, `${where}: 呼吸なしなら指示に従えない`).toBe(false);
  }

  // 橈骨動脈が触知できなければ脈拍は数えられない
  if (!c.radialPulsePalpable) {
    expect(c.pulseRate, `${where}: 触知不能なら脈拍は null`).toBeNull();
  } else {
    expect(c.pulseRate, `${where}: 触知可なら脈拍を持つ`).not.toBeNull();
    expect(c.pulseRate as number, `${where}: 脈拍が非現実的`).toBeGreaterThan(20);
    expect(c.pulseRate as number, `${where}: 脈拍が非現実的`).toBeLessThan(220);
    // 脈拍 120 以上なら CRT は 1.5 秒以上（生理学的整合）
    if ((c.pulseRate as number) >= 120) {
      expect(c.crtSeconds, `${where}: 脈拍120以上なのに CRT が速すぎる`).toBeGreaterThanOrEqual(1.5);
    }
  }

  // CRT の値域と浮動小数誤差
  expect(c.crtSeconds, `${where}: CRT が負`).toBeGreaterThan(0);
  expect(c.crtSeconds, `${where}: CRT が非現実的`).toBeLessThanOrEqual(4.0);
  expect(c.crtSeconds, `${where}: CRT に浮動小数誤差`).toBe(Number(c.crtSeconds.toFixed(1)));

  // 歩行可能なら軽症域
  if (c.canWalk) {
    expect(c.obeysCommands, `${where}: 歩行可能なら指示に従える`).toBe(true);
    expect(c.radialPulsePalpable, `${where}: 歩行可能なら橈骨動脈は触知可`).toBe(true);
    expect(c.crtSeconds, `${where}: 歩行可能なら CRT は正常`).toBeLessThan(JP_FDMA.crtThresholdSeconds);
  }
}

describe('generator: 不変条件（SPEC §3.3）', () => {
  it(`${ITERATIONS.toLocaleString()}回: 生成した症例を judge に通した結果が必ず target と一致する`, () => {
    const rng = createRng('invariant-category');
    const failures: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const target = CATEGORIES[i % CATEGORIES.length] as Category;
      const g = generateCase({ target }, rng);
      const j = judge(g.case, JP_FDMA);
      if (j.category !== target) {
        failures.push(
          `#${i} target=${target} actual=${j.category} step=${g.decidingStep} case=${JSON.stringify(g.case)}`,
        );
      }
    }

    expect(failures.slice(0, 5)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it(`${ITERATIONS.toLocaleString()}回: judge が返す decidingStep が生成時の意図と一致する`, () => {
    const rng = createRng('invariant-step');
    const failures: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const g = generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng);
      const j = judge(g.case, JP_FDMA);
      if (j.decidingStep !== combo.decidingStep || j.category !== combo.target) {
        failures.push(
          `#${i} 意図=${combo.target}/${combo.decidingStep} 実際=${j.category}/${j.decidingStep} case=${JSON.stringify(g.case)}`,
        );
      }
    }

    expect(failures.slice(0, 5)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it(`${ITERATIONS.toLocaleString()}回: 症例データ自体に矛盾がない`, () => {
    const rng = createRng('invariant-consistency');
    for (let i = 0; i < ITERATIONS; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      assertInternallyConsistent(
        generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng),
      );
    }
  });

  it('judge は生成した症例に対して例外を投げない', () => {
    const rng = createRng('invariant-no-throw');
    for (let i = 0; i < 2000; i++) {
      const target = CATEGORIES[i % CATEGORIES.length] as Category;
      const g = generateCase({ target }, rng);
      expect(() => judge(g.case, JP_FDMA)).not.toThrow();
    }
  });
});

describe('generator: 決定性', () => {
  it('同一シードは同一の症例列を生成する', () => {
    const run = () => {
      const rng = createRng('determinism');
      return Array.from({ length: 30 }, (_, i) =>
        generateCase({ target: CATEGORIES[i % CATEGORIES.length] as Category }, rng),
      );
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it('異なるシードは異なる症例列を生成する', () => {
    const run = (seed: string) => {
      const rng = createRng(seed);
      return Array.from({ length: 30 }, (_, i) =>
        generateCase({ target: CATEGORIES[i % CATEGORIES.length] as Category }, rng),
      );
    };
    expect(JSON.stringify(run('a'))).not.toBe(JSON.stringify(run('b')));
  });
});

describe('generator: 組み合わせの検証', () => {
  it('成立しない組み合わせはエラーになる', () => {
    const rng = createRng('impossible');
    const impossible: [Category, DecidingStep][] = [];
    for (const target of CATEGORIES) {
      for (const step of DECIDING_STEPS) {
        if (!VALID_COMBINATIONS.some((c) => c.target === target && c.decidingStep === step)) {
          impossible.push([target, step]);
        }
      }
    }
    // 4区分 × 5ステップ = 20 通りのうち 7 通りが有効
    expect(impossible).toHaveLength(13);

    for (const [target, decidingStep] of impossible) {
      expect(() => generateCase({ target, decidingStep }, rng), `${target}/${decidingStep}`).toThrow(
        ImpossibleCombinationError,
      );
    }
  });

  it('decidingStepsFor が各区分の有効ステップを返す', () => {
    expect(decidingStepsFor('III')).toEqual(['walk']);
    expect(decidingStepsFor('0')).toEqual(['airway']);
    expect(decidingStepsFor('II')).toEqual(['consciousness']);
    expect(decidingStepsFor('I').sort()).toEqual(['airway', 'circulation', 'consciousness', 'respiratoryRate']);
  });

  it('decidingStep 省略時は有効なステップのみを使う', () => {
    const rng = createRng('auto-step');
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const g = generateCase({ target: 'I' }, rng);
      seen.add(g.decidingStep);
    }
    // I類は4経路すべてから生成され得る
    expect([...seen].sort()).toEqual(['airway', 'circulation', 'consciousness', 'respiratoryRate']);
  });
});

describe('generator: 境界値バイアス（SPEC §3.3）', () => {
  it('boundaryRate=1 なら確定ステップは必ず境界値になる', () => {
    const rng = createRng('boundary-always');
    for (let i = 0; i < 500; i++) {
      const g = generateCase({ target: 'I', decidingStep: 'respiratoryRate', boundaryRate: 1 }, rng);
      expect(g.usedBoundary).toBe(true);
      expect([JP_FDMA.respiratoryRateLowMax, JP_FDMA.respiratoryRateHighMin]).toContain(g.case.respiratoryRate);
    }
  });

  it('boundaryRate=0 なら境界値を使わない', () => {
    const rng = createRng('boundary-never');
    for (let i = 0; i < 500; i++) {
      const g = generateCase({ target: 'I', decidingStep: 'circulation', boundaryRate: 0 }, rng);
      expect(g.usedBoundary).toBe(false);
    }
  });

  it('循環の境界値は CRT が閾値ちょうどになる', () => {
    const rng = createRng('boundary-crt');
    for (let i = 0; i < 300; i++) {
      const g = generateCase({ target: 'I', decidingStep: 'circulation', boundaryRate: 1 }, rng);
      expect(g.case.crtSeconds).toBe(JP_FDMA.crtThresholdSeconds);
    }
  });

  it('意識で確定する症例の境界値は CRT が閾値の直下になる', () => {
    const rng = createRng('boundary-crt-pass');
    for (let i = 0; i < 300; i++) {
      const g = generateCase({ target: 'II', decidingStep: 'consciousness', boundaryRate: 1 }, rng);
      expect(g.case.crtSeconds).toBe(1.9);
      // 通過側の呼吸数も境界値になる
      expect([10, 29]).toContain(g.case.respiratoryRate);
    }
  });

  it('既定の境界値率は実測で概ね 35% になる', () => {
    const rng = createRng('boundary-rate');
    const n = 5000;
    let boundary = 0;
    for (let i = 0; i < n; i++) {
      // 境界値を取り得るステップのみで計測する
      if (generateCase({ target: 'I', decidingStep: 'respiratoryRate' }, rng).usedBoundary) boundary++;
    }
    expect(boundary / n).toBeGreaterThan(DEFAULT_BOUNDARY_RATE - 0.03);
    expect(boundary / n).toBeLessThan(DEFAULT_BOUNDARY_RATE + 0.03);
  });
});

describe('generator: 呼吸数の値域', () => {
  it('呼吸数で確定する I類は下限域と上限域の両方を生成する', () => {
    const rng = createRng('rr-bands');
    let low = 0;
    let high = 0;
    for (let i = 0; i < 3000; i++) {
      const rr = generateCase({ target: 'I', decidingStep: 'respiratoryRate' }, rng).case.respiratoryRate;
      if (rr === null) throw new Error('呼吸数が null');
      if (rr <= JP_FDMA.respiratoryRateLowMax) low++;
      else high++;
    }
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(0);
  });

  it('呼吸数を通過する症例は 10〜29 回/分に収まる', () => {
    const rng = createRng('rr-pass');
    for (let i = 0; i < 2000; i++) {
      const rr = generateCase({ target: 'II' }, rng).case.respiratoryRate;
      expect(rr).toBeGreaterThanOrEqual(10);
      expect(rr).toBeLessThanOrEqual(29);
    }
  });
});

describe('generator: 循環の2系統', () => {
  it('循環で確定する症例は CRT遅延 と 橈骨動脈触知不能 の両方を生成する', () => {
    const rng = createRng('circulation-variants');
    let viaCrt = 0;
    let viaRadial = 0;
    for (let i = 0; i < 3000; i++) {
      const c = generateCase({ target: 'I', decidingStep: 'circulation' }, rng).case;
      if (!c.radialPulsePalpable) viaRadial++;
      else if (c.crtSeconds >= JP_FDMA.crtThresholdSeconds) viaCrt++;
    }
    expect(viaRadial).toBeGreaterThan(0);
    expect(viaCrt).toBeGreaterThan(0);
  });

  it('CRTが正常でも橈骨動脈触知不能で I類になる症例が生成される', () => {
    const rng = createRng('radial-only');
    let found = 0;
    for (let i = 0; i < 3000; i++) {
      const c = generateCase({ target: 'I', decidingStep: 'circulation' }, rng).case;
      if (!c.radialPulsePalpable && c.crtSeconds < JP_FDMA.crtThresholdSeconds) found++;
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('generator: 別プロファイルでも不変条件を満たす', () => {
  it('US-START プロファイルで生成した症例は US-START で判定が一致する', () => {
    const rng = createRng('us-start');
    for (let i = 0; i < 2000; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const g = generateCase(
        { target: combo.target, decidingStep: combo.decidingStep, profile: US_START },
        rng,
      );
      const j = judge(g.case, US_START);
      expect(j.category, JSON.stringify(g.case)).toBe(combo.target);
      expect(j.decidingStep, JSON.stringify(g.case)).toBe(combo.decidingStep);
    }
  });

  it('US-START では呼吸数の下限域を生成しない（下限判定を行わないため）', () => {
    const rng = createRng('us-start-rr');
    for (let i = 0; i < 1000; i++) {
      const rr = generateCase(
        { target: 'I', decidingStep: 'respiratoryRate', profile: US_START },
        rng,
      ).case.respiratoryRate;
      expect(rr).toBeGreaterThanOrEqual(US_START.respiratoryRateHighMin);
    }
  });
});
