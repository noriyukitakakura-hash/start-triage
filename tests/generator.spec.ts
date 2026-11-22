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
import { ALL_SITUATION_KEYS, ILLUSTRATIONS } from '@/domain/illustrations';
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
  expect(illustration?.situationKeys, `${where}: 状況文キーがカタログ外`).toContain(c.patient.situationKey);

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

  // 従命の可否と反応の整合
  if (c.obeysCommands) {
    expect(c.nonObeyingResponse, `${where}: 従命できるなら反応の種別は持たない`).toBeNull();
  } else {
    expect(c.nonObeyingResponse, `${where}: 従命できないなら反応の種別を持つ`).not.toBeNull();
    // **自発呼吸が無ければ声は出せない。** 無呼吸でうめき声を上げるのは矛盾
    if (!c.hasSpontaneousBreathing) {
      expect(c.nonObeyingResponse, `${where}: 無呼吸なのに発声している`).not.toBe('voiceOnly');
    }
  }

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

describe('generator: イラストと状況文の到達性', () => {
  it(`${ITERATIONS.toLocaleString()}回で全イラストと全状況文が少なくとも1回出る`, () => {
    // 抽選が片寄っていても「カタログにある」検査だけは通ってしまう。
    // **増やした項目が実際に出題されること**は別に確かめる必要がある
    const rng = createRng('coverage');
    const ids = new Set<string>();
    const keys = new Set<string>();

    for (let i = 0; i < ITERATIONS; i++) {
      const g = generateCase({ target: CATEGORIES[i % CATEGORIES.length] as Category }, rng);
      ids.add(g.case.patient.illustrationId);
      keys.add(g.case.patient.situationKey);
    }

    expect(ILLUSTRATIONS.map((i) => i.id).filter((id) => !ids.has(id))).toEqual([]);
    expect(ALL_SITUATION_KEYS.filter((k) => !keys.has(k))).toEqual([]);
  });

  it('同じイラストでも状況文は複数現れる', () => {
    const rng = createRng('variety');
    const byId = new Map<string, Set<string>>();

    for (let i = 0; i < 2_000; i++) {
      const g = generateCase({ target: CATEGORIES[i % CATEGORIES.length] as Category }, rng);
      const set = byId.get(g.case.patient.illustrationId) ?? new Set<string>();
      set.add(g.case.patient.situationKey);
      byId.set(g.case.patient.illustrationId, set);
    }

    for (const illustration of ILLUSTRATIONS) {
      if (illustration.situationKeys.length < 2) continue;
      expect(
        byId.get(illustration.id)?.size ?? 0,
        `${illustration.id}: 状況文が1種類しか出ていない`,
      ).toBeGreaterThan(1);
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

// ---------------------------------------------------------------------------
// 実測モード: 呼吸数の判別マージン（docs/OBSERVATION.md）
// ---------------------------------------------------------------------------

const OBSERVED_MARGIN = 4;

describe('generator: 実測モードの呼吸数マージン', () => {
  it(`${ITERATIONS.toLocaleString()}回: 全症例の呼吸数が閾値から ${OBSERVED_MARGIN} 以上離れている`, () => {
    const rng = createRng('rr-margin-invariant');
    const failures: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const g = generateCase(
        { target: combo.target, decidingStep: combo.decidingStep, rrMargin: OBSERVED_MARGIN },
        rng,
      );
      const rr = g.case.respiratoryRate;

      // 無呼吸症例（呼吸数0）はマージンの対象外。閾値判定を経ないため
      if (!g.case.hasSpontaneousBreathing) continue;
      if (rr === null) {
        failures.push(`#${i} 呼吸ありなのに呼吸数が null`);
        continue;
      }

      const lowDistance = Math.abs(rr - JP_FDMA.respiratoryRateLowMax);
      const highDistance = Math.abs(rr - JP_FDMA.respiratoryRateHighMin);
      // 閾値そのもの（9, 30）と、その直近 margin-1 回分の値を取らない
      if (lowDistance < OBSERVED_MARGIN && highDistance < OBSERVED_MARGIN) {
        failures.push(`#${i} rr=${rr} が両閾値に近すぎる`);
      } else if (lowDistance < OBSERVED_MARGIN || highDistance < OBSERVED_MARGIN) {
        failures.push(`#${i} rr=${rr} が閾値に近すぎる (low差${lowDistance} high差${highDistance})`);
      }
    }

    expect(failures.slice(0, 5)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it(`${ITERATIONS.toLocaleString()}回: マージンを入れても judge の結果が target と一致する`, () => {
    const rng = createRng('rr-margin-judge');
    const failures: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const g = generateCase(
        { target: combo.target, decidingStep: combo.decidingStep, rrMargin: OBSERVED_MARGIN },
        rng,
      );
      const j = judge(g.case, JP_FDMA);
      if (j.category !== combo.target || j.decidingStep !== combo.decidingStep) {
        failures.push(`#${i} 意図=${combo.target}/${combo.decidingStep} 実際=${j.category}/${j.decidingStep}`);
      }
    }

    expect(failures.slice(0, 5)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it('マージンを入れても症例データ自体に矛盾がない', () => {
    const rng = createRng('rr-margin-consistency');
    for (let i = 0; i < 3000; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      assertInternallyConsistent(
        generateCase(
          { target: combo.target, decidingStep: combo.decidingStep, rrMargin: OBSERVED_MARGIN },
          rng,
        ),
      );
    }
  });

  it('値域が設計どおり（通過14〜25 / 該当下限4〜5 / 該当上限34〜44）', () => {
    const rng = createRng('rr-margin-bands');
    const pass = new Set<number>();
    const failLow = new Set<number>();
    const failHigh = new Set<number>();

    for (let i = 0; i < 6000; i++) {
      // 通過側: 意識で確定する症例
      const p = generateCase({ target: 'II', rrMargin: OBSERVED_MARGIN }, rng).case.respiratoryRate;
      if (p !== null) pass.add(p);

      // 該当側: 呼吸数で確定する症例
      const f = generateCase(
        { target: 'I', decidingStep: 'respiratoryRate', rrMargin: OBSERVED_MARGIN },
        rng,
      ).case.respiratoryRate;
      if (f === null) continue;
      if (f <= JP_FDMA.respiratoryRateLowMax) failLow.add(f);
      else failHigh.add(f);
    }

    expect(Math.min(...pass)).toBe(14);
    expect(Math.max(...pass)).toBe(25);
    expect(Math.min(...failLow)).toBe(4);
    expect(Math.max(...failLow)).toBe(5);
    expect(Math.min(...failHigh)).toBe(34);
    expect(Math.max(...failHigh)).toBe(44);
  });

  it('15秒の観察で3帯が分離する（呼吸回数が重ならない）', () => {
    // 該当下限 5回/分 → 1.25回、通過 14〜25回/分 → 3.5〜6.25回、該当上限 34回/分 → 8.5回
    const at15s = (rr: number) => (rr * 15) / 60;
    expect(at15s(5)).toBeLessThan(at15s(14));
    expect(at15s(25)).toBeLessThan(at15s(34));
    // 帯の間に1回以上の差があり、数え間違い1回では区分が反転しない
    expect(at15s(14) - at15s(5)).toBeGreaterThan(1);
    expect(at15s(34) - at15s(25)).toBeGreaterThan(1);
  });

  it('呼吸数ステップの usedBoundary は実測モードでは常に false', () => {
    const rng = createRng('rr-margin-no-boundary');
    for (let i = 0; i < 3000; i++) {
      const g = generateCase(
        { target: 'I', decidingStep: 'respiratoryRate', rrMargin: OBSERVED_MARGIN, boundaryRate: 1 },
        rng,
      );
      expect(g.usedBoundary).toBe(false);
    }
  });

  it('通過側の呼吸数も境界値（10・29）を取らない', () => {
    const rng = createRng('rr-margin-pass-no-boundary');
    for (let i = 0; i < 3000; i++) {
      const rr = generateCase(
        { target: 'II', rrMargin: OBSERVED_MARGIN, boundaryRate: 1 },
        rng,
      ).case.respiratoryRate;
      expect(rr).not.toBe(10);
      expect(rr).not.toBe(29);
    }
  });

  it('循環・意識の境界値は実測モードでも有効（呼吸数以外は影響を受けない）', () => {
    const rng = createRng('rr-margin-other-boundaries');
    for (let i = 0; i < 500; i++) {
      const circ = generateCase(
        { target: 'I', decidingStep: 'circulation', rrMargin: OBSERVED_MARGIN, boundaryRate: 1 },
        rng,
      );
      expect(circ.usedBoundary).toBe(true);
      expect(circ.case.crtSeconds).toBe(JP_FDMA.crtThresholdSeconds);

      const cons = generateCase(
        { target: 'II', decidingStep: 'consciousness', rrMargin: OBSERVED_MARGIN, boundaryRate: 1 },
        rng,
      );
      expect(cons.usedBoundary).toBe(true);
      expect(cons.case.crtSeconds).toBe(1.9);
    }
  });

  it('マージンが大きすぎて通過域が空になる場合はエラー', () => {
    const rng = createRng('rr-margin-too-large');
    // 通過域 10〜29 に対し margin 10 で [20, 19] となり空
    expect(() => generateCase({ target: 'II', rrMargin: 10 }, rng)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// 実測モード: CRT の判別マージン（docs/OBSERVATION.md）
// ---------------------------------------------------------------------------

const OBSERVED_CRT_MARGIN = 0.5;

/** 閾値からの距離。実測モードではこれが margin 以上でなければならない */
function crtDistance(crt: number): number {
  return Math.abs(crt - JP_FDMA.crtThresholdSeconds);
}

describe('generator: 実測モードのCRTマージン', () => {
  it(`${ITERATIONS.toLocaleString()}回: 全症例のCRTが閾値から ${OBSERVED_CRT_MARGIN} 以上離れている`, () => {
    const rng = createRng('crt-margin-invariant');
    const failures: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const g = generateCase(
        { target: combo.target, decidingStep: combo.decidingStep, crtMargin: OBSERVED_CRT_MARGIN },
        rng,
      );
      const distance = crtDistance(g.case.crtSeconds);
      if (distance < OBSERVED_CRT_MARGIN) {
        failures.push(`#${i} crt=${g.case.crtSeconds} (${g.target}/${g.decidingStep}) 距離${distance.toFixed(1)}`);
      }
    }

    expect(failures.slice(0, 5)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it('循環を評価しない症例（歩行可・気道確保）のCRTも離れている', () => {
    const rng = createRng('crt-margin-free');
    for (let i = 0; i < 3000; i++) {
      for (const combo of [
        { target: 'III', decidingStep: 'walk' },
        { target: '0', decidingStep: 'airway' },
        { target: 'I', decidingStep: 'respiratoryRate' },
      ] as const) {
        const g = generateCase(
          { target: combo.target, decidingStep: combo.decidingStep, crtMargin: OBSERVED_CRT_MARGIN },
          rng,
        );
        expect(
          crtDistance(g.case.crtSeconds),
          `${combo.target}/${combo.decidingStep} crt=${g.case.crtSeconds}`,
        ).toBeGreaterThanOrEqual(OBSERVED_CRT_MARGIN);
      }
    }
  });

  it(`${ITERATIONS.toLocaleString()}回: CRTマージンを入れても judge の結果が target と一致する`, () => {
    const rng = createRng('crt-margin-judge');
    const failures: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const g = generateCase(
        {
          target: combo.target,
          decidingStep: combo.decidingStep,
          rrMargin: OBSERVED_MARGIN,
          crtMargin: OBSERVED_CRT_MARGIN,
        },
        rng,
      );
      const j = judge(g.case, JP_FDMA);
      if (j.category !== combo.target || j.decidingStep !== combo.decidingStep) {
        failures.push(`#${i} 意図=${combo.target}/${combo.decidingStep} 実際=${j.category}/${j.decidingStep}`);
      }
    }

    expect(failures.slice(0, 5)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it('両マージンを入れても症例データ自体に矛盾がない', () => {
    const rng = createRng('crt-margin-consistency');
    for (let i = 0; i < 3000; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      assertInternallyConsistent(
        generateCase(
          {
            target: combo.target,
            decidingStep: combo.decidingStep,
            rrMargin: OBSERVED_MARGIN,
            crtMargin: OBSERVED_CRT_MARGIN,
          },
          rng,
        ),
      );
    }
  });

  it('値域が設計どおり（通過 1.0〜1.5 / 該当 2.5〜4.0）', () => {
    const rng = createRng('crt-margin-bands');
    const pass = new Set<number>();
    const fail = new Set<number>();

    for (let i = 0; i < 8000; i++) {
      // 意識で確定する症例は循環を通過している
      pass.add(generateCase({ target: 'II', crtMargin: OBSERVED_CRT_MARGIN }, rng).case.crtSeconds);

      const f = generateCase(
        { target: 'I', decidingStep: 'circulation', crtMargin: OBSERVED_CRT_MARGIN },
        rng,
      ).case;
      // 橈骨動脈触知不能で確定した症例は CRT が正常域のこともある
      if (f.radialPulsePalpable) fail.add(f.crtSeconds);
    }

    expect(Math.min(...pass)).toBe(1.0);
    expect(Math.max(...pass)).toBe(1.5);
    expect(Math.min(...fail)).toBe(2.5);
    expect(Math.max(...fail)).toBe(4.0);
  });

  it('脈拍120以上の症例はCRTが1.5秒以上（生理学的整合を保つ）', () => {
    const rng = createRng('crt-margin-pulse');
    for (let i = 0; i < 5000; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const c = generateCase(
        { target: combo.target, decidingStep: combo.decidingStep, crtMargin: OBSERVED_CRT_MARGIN },
        rng,
      ).case;
      if (c.pulseRate !== null && c.pulseRate >= 120) {
        expect(c.crtSeconds, `pulse=${c.pulseRate} crt=${c.crtSeconds}`).toBeGreaterThanOrEqual(1.5);
      }
    }
  });

  it('循環ステップの usedBoundary は実測モードでは常に false', () => {
    const rng = createRng('crt-margin-no-boundary');
    for (let i = 0; i < 2000; i++) {
      const g = generateCase(
        {
          target: 'I',
          decidingStep: 'circulation',
          rrMargin: OBSERVED_MARGIN,
          crtMargin: OBSERVED_CRT_MARGIN,
          boundaryRate: 1,
        },
        rng,
      );
      expect(g.usedBoundary).toBe(false);
      expect(g.case.crtSeconds).not.toBe(JP_FDMA.crtThresholdSeconds);
    }
  });

  it('マージンが大きすぎて通過域が空になる場合はエラー', () => {
    const rng = createRng('crt-margin-too-large');
    expect(() => generateCase({ target: 'II', crtMargin: 1.5 }, rng)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// 意識: 声かけへの反応（SPEC §2.2）
// ---------------------------------------------------------------------------

describe('generator: 従命できない症例の反応', () => {
  it(`${ITERATIONS.toLocaleString()}回: 従命の可否と反応が常に整合する`, () => {
    const rng = createRng('consciousness-invariant');
    const failures: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const c = generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng).case;

      if (c.obeysCommands && c.nonObeyingResponse !== null) {
        failures.push(`#${i} 従命できるのに反応の種別を持つ: ${c.nonObeyingResponse}`);
      }
      if (!c.obeysCommands && c.nonObeyingResponse === null) {
        failures.push(`#${i} 従命できないのに反応の種別が無い`);
      }
      if (!c.hasSpontaneousBreathing && c.nonObeyingResponse === 'voiceOnly') {
        failures.push(`#${i} 無呼吸なのに発声している`);
      }
    }

    expect(failures.slice(0, 5)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it('3種類の反応がいずれも生成される', () => {
    const rng = createRng('consciousness-variety');
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const c = generateCase({ target: 'I', decidingStep: 'consciousness' }, rng).case;
      if (c.nonObeyingResponse !== null) seen.add(c.nonObeyingResponse);
    }
    expect([...seen].sort()).toEqual(['movementOnly', 'none', 'voiceOnly']);
  });

  it('無呼吸の症例は体動か無反応のみ', () => {
    const rng = createRng('consciousness-apneic');
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      for (const target of ['I', '0'] as const) {
        const c = generateCase({ target, decidingStep: 'airway' }, rng).case;
        expect(c.nonObeyingResponse).not.toBe('voiceOnly');
        if (c.nonObeyingResponse !== null) seen.add(c.nonObeyingResponse);
      }
    }
    expect([...seen].sort()).toEqual(['movementOnly', 'none']);
  });

  it('II類（従命あり）は反応の種別を持たない', () => {
    const rng = createRng('consciousness-obeys');
    for (let i = 0; i < 1000; i++) {
      const c = generateCase({ target: 'II' }, rng).case;
      expect(c.obeysCommands).toBe(true);
      expect(c.nonObeyingResponse).toBeNull();
    }
  });
});
