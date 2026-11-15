import { describe, expect, it } from 'vitest';
import { judge, InconsistentCaseError } from '@/domain/judge';
import { JP_FDMA, US_START } from '@/domain/profiles';
import type { Category, DecidingStep, TriageCase } from '@/domain/types';

/** 「どのステップも通過する」健常寄りの基準症例。各テストで必要な項目だけ上書きする */
const BASE: TriageCase = {
  id: 'test',
  patient: { illustrationId: 'supine', situationKey: 'situation.lyingStill' },
  canWalk: false,
  hasSpontaneousBreathing: true,
  breathingAfterAirway: null,
  respiratoryRate: 18,
  radialPulsePalpable: true,
  pulseRate: 88,
  crtSeconds: 1.2,
  obeysCommands: true,
};

function make(overrides: Partial<TriageCase>): TriageCase {
  return { ...BASE, ...overrides };
}

describe('judge: 基準症例', () => {
  it('全ステップを通過すると II類', () => {
    const j = judge(BASE, JP_FDMA);
    expect(j.category).toBe('II');
    expect(j.decidingStep).toBe('consciousness');
  });
});

describe('judge: 手順1 歩行', () => {
  it('歩行可能なら III類（他のバイタルを問わない）', () => {
    const j = judge(
      make({
        canWalk: true,
        // 以下はすべて I類相当だが、歩行可能なら評価されない
        respiratoryRate: 40,
        radialPulsePalpable: false,
        pulseRate: null,
        crtSeconds: 3.5,
        obeysCommands: false,
      }),
      JP_FDMA,
    );
    expect(j.category).toBe('III');
    expect(j.decidingStep).toBe('walk');
    // 歩行の1項目だけで確定し、以降の観察を根拠に含めない
    expect(j.rationale).toEqual([{ key: 'rationale.canWalk' }]);
  });
});

describe('judge: 手順2 自発呼吸と気道確保', () => {
  it('呼吸なし→気道確保で再開すれば I類', () => {
    const j = judge(
      make({ hasSpontaneousBreathing: false, breathingAfterAirway: true, respiratoryRate: 0 }),
      JP_FDMA,
    );
    expect(j.category).toBe('I');
    expect(j.decidingStep).toBe('airway');
  });

  it('呼吸なし→気道確保後も再開しなければ 0類', () => {
    const j = judge(
      make({
        hasSpontaneousBreathing: false,
        breathingAfterAirway: false,
        respiratoryRate: 0,
        obeysCommands: false,
      }),
      JP_FDMA,
    );
    expect(j.category).toBe('0');
    expect(j.decidingStep).toBe('airway');
  });

  it('呼吸なしの症例では呼吸数以降を評価しない', () => {
    // 呼吸数40（I類相当）だが、気道確保で再開しなければ 0類が正
    const j = judge(
      make({ hasSpontaneousBreathing: false, breathingAfterAirway: false, respiratoryRate: 40 }),
      JP_FDMA,
    );
    expect(j.category).toBe('0');
  });
});

describe('judge: 手順3 呼吸数の境界値（JP-FDMA: ≦9 または ≧30 で I類）', () => {
  const cases: [rr: number, expected: Category, note: string][] = [
    [0, 'I', '下限域'],
    [5, 'I', '下限域'],
    [8, 'I', '境界の1つ内側'],
    [9, 'I', '境界値（9は I類）'],
    [10, 'II', '境界値（10は通過）'],
    [11, 'II', '境界の1つ外側'],
    [18, 'II', '正常域'],
    [28, 'II', '境界の1つ外側'],
    [29, 'II', '境界値（29は通過）'],
    [30, 'I', '境界値（30は I類）'],
    [31, 'I', '境界の1つ内側'],
    [44, 'I', '上限域'],
  ];

  it.each(cases)('呼吸数 %i → %s類 (%s)', (rr, expected) => {
    expect(judge(make({ respiratoryRate: rr }), JP_FDMA).category).toBe(expected);
  });

  it('呼吸数で確定した場合 decidingStep は respiratoryRate', () => {
    expect(judge(make({ respiratoryRate: 30 }), JP_FDMA).decidingStep).toBe('respiratoryRate');
    expect(judge(make({ respiratoryRate: 9 }), JP_FDMA).decidingStep).toBe('respiratoryRate');
  });

  it('根拠に実測値と閾値が含まれる', () => {
    const high = judge(make({ respiratoryRate: 32 }), JP_FDMA);
    expect(high.rationale).toContainEqual({ key: 'rationale.rrHigh', params: { rr: 32, threshold: 30 } });

    const low = judge(make({ respiratoryRate: 8 }), JP_FDMA);
    expect(low.rationale).toContainEqual({ key: 'rationale.rrLow', params: { rr: 8, threshold: 9 } });
  });
});

describe('judge: 手順4 循環の境界値（CRT ≧2秒 または 橈骨動脈触知不能で I類）', () => {
  const crtCases: [crt: number, expected: Category, note: string][] = [
    [0.5, 'II', '速い'],
    [1.0, 'II', '正常'],
    [1.9, 'II', '境界値（1.9は通過）'],
    [1.99, 'II', '境界の直下'],
    [2.0, 'I', '境界値（2.0は I類）'],
    [2.1, 'I', '境界の直上'],
    [4.0, 'I', '著明な遅延'],
  ];

  it.each(crtCases)('CRT %s秒 → %s類 (%s)', (crt, expected) => {
    expect(judge(make({ crtSeconds: crt }), JP_FDMA).category).toBe(expected);
  });

  it('橈骨動脈が触知不能なら CRT が正常でも I類', () => {
    const j = judge(make({ radialPulsePalpable: false, pulseRate: null, crtSeconds: 1.0 }), JP_FDMA);
    expect(j.category).toBe('I');
    expect(j.decidingStep).toBe('circulation');
    expect(j.rationale).toContainEqual({ key: 'rationale.radialPulseAbsent' });
  });

  it('循環で確定した場合 decidingStep は circulation', () => {
    expect(judge(make({ crtSeconds: 2.0 }), JP_FDMA).decidingStep).toBe('circulation');
  });

  it('脈拍数は判定に影響しない（JP-FDMA の参考値。SPEC §3.2 手順4）', () => {
    const fast = judge(make({ pulseRate: 150 }), JP_FDMA);
    const slow = judge(make({ pulseRate: 60 }), JP_FDMA);
    expect(fast.category).toBe('II');
    expect(slow.category).toBe('II');
  });
});

describe('judge: 手順5 意識', () => {
  it('簡単な指示に従えなければ I類', () => {
    const j = judge(make({ obeysCommands: false }), JP_FDMA);
    expect(j.category).toBe('I');
    expect(j.decidingStep).toBe('consciousness');
  });

  it('従えれば II類', () => {
    const j = judge(make({ obeysCommands: true }), JP_FDMA);
    expect(j.category).toBe('II');
    expect(j.decidingStep).toBe('consciousness');
  });
});

describe('judge: 評価順序（先のステップが後のステップを打ち消す）', () => {
  it('呼吸数が基準外なら循環・意識が正常でも I類', () => {
    expect(judge(make({ respiratoryRate: 35, crtSeconds: 1.0, obeysCommands: true }), JP_FDMA).decidingStep).toBe(
      'respiratoryRate',
    );
  });

  it('循環が基準外なら意識が正常でも I類', () => {
    expect(judge(make({ crtSeconds: 2.5, obeysCommands: true }), JP_FDMA).decidingStep).toBe('circulation');
  });

  it('歩行可能はすべてに優先する', () => {
    expect(judge(make({ canWalk: true, hasSpontaneousBreathing: false, breathingAfterAirway: false }), JP_FDMA).category).toBe('III');
  });
});

describe('judge: 根拠は通過したステップを順序どおり含む', () => {
  it('意識で確定した II類は5項目すべての観察を含む', () => {
    const j = judge(BASE, JP_FDMA);
    expect(j.rationale.map((r) => r.key)).toEqual([
      'rationale.cannotWalk',
      'rationale.hasBreathing',
      'rationale.rrNormal',
      'rationale.circulationOk',
      'rationale.obeysCommands',
    ]);
  });

  it('呼吸数で確定した I類は循環・意識の観察を含まない', () => {
    const keys = judge(make({ respiratoryRate: 36 }), JP_FDMA).rationale.map((r) => r.key);
    expect(keys).toEqual(['rationale.cannotWalk', 'rationale.hasBreathing', 'rationale.rrHigh']);
    expect(keys).not.toContain('rationale.circulationOk');
    expect(keys).not.toContain('rationale.obeysCommands');
  });
});

describe('judge: プロファイルの差（docs/I18N.md §2 の前提）', () => {
  it('同一症例でも JP-FDMA と US-START で結果が異なる', () => {
    // 呼吸数8: 日本版は I類（≦9）、米国版原典は下限判定を行わないため通過する
    const slow = make({ respiratoryRate: 8 });
    expect(judge(slow, JP_FDMA).category).toBe('I');
    expect(judge(slow, US_START).category).toBe('II');
  });

  it('呼吸数30は JP-FDMA では I類、US-START では通過する（>30 のみ）', () => {
    const rr30 = make({ respiratoryRate: 30 });
    expect(judge(rr30, JP_FDMA).category).toBe('I');
    expect(judge(rr30, US_START).category).toBe('II');
  });

  it('呼吸数31は両プロファイルで I類', () => {
    const rr31 = make({ respiratoryRate: 31 });
    expect(judge(rr31, JP_FDMA).category).toBe('I');
    expect(judge(rr31, US_START).category).toBe('I');
  });
});

describe('judge: 矛盾した症例は黙って誤判定せず失敗する', () => {
  it('呼吸なしなのに breathingAfterAirway が null', () => {
    expect(() =>
      judge(make({ hasSpontaneousBreathing: false, breathingAfterAirway: null }), JP_FDMA),
    ).toThrow(InconsistentCaseError);
  });

  it('呼吸ありなのに respiratoryRate が null', () => {
    expect(() => judge(make({ hasSpontaneousBreathing: true, respiratoryRate: null }), JP_FDMA)).toThrow(
      InconsistentCaseError,
    );
  });
});

describe('judge: 全 DecidingStep が到達可能', () => {
  it('5つのステップすべてが実際に判定を確定させ得る', () => {
    const reached = new Set<DecidingStep>([
      judge(make({ canWalk: true }), JP_FDMA).decidingStep,
      judge(make({ hasSpontaneousBreathing: false, breathingAfterAirway: false }), JP_FDMA).decidingStep,
      judge(make({ respiratoryRate: 40 }), JP_FDMA).decidingStep,
      judge(make({ crtSeconds: 3 }), JP_FDMA).decidingStep,
      judge(make({ obeysCommands: false }), JP_FDMA).decidingStep,
    ]);
    expect([...reached].sort()).toEqual(['airway', 'circulation', 'consciousness', 'respiratoryRate', 'walk']);
  });
});
