import { describe, expect, it } from 'vitest';
import { CONCLUSION_KEY, explain } from '@/domain/explain';
import { VALID_COMBINATIONS, generateCase } from '@/domain/generator';
import { JP_FDMA } from '@/domain/profiles';
import { createRng } from '@/domain/rng';
import { DECIDING_STEPS, type TriageCase } from '@/domain/types';

const BASE: TriageCase = {
  id: 'explain-test',
  patient: { illustrationId: 'supine-still', situationKey: 'situation.lyingStill' },
  canWalk: false,
  hasSpontaneousBreathing: true,
  breathingAfterAirway: null,
  respiratoryRate: 18,
  radialPulsePalpable: true,
  pulseRate: 88,
  crtSeconds: 1.2,
  obeysCommands: true,
};

const make = (o: Partial<TriageCase>): TriageCase => ({ ...BASE, ...o });

describe('explain: ステップの状態', () => {
  it('歩行可能な III類は歩行のみ評価され、残り4ステップは評価不要', () => {
    const e = explain(make({ canWalk: true, patient: { illustrationId: 'walking-unaided', situationKey: 'situation.walkedOnOwn' } }), JP_FDMA);

    expect(e.category).toBe('III');
    expect(e.decidingStep).toBe('walk');
    expect(e.steps.map((s) => s.status)).toEqual(['decided', 'skipped', 'skipped', 'skipped', 'skipped']);
    expect(e.skippedCount).toBe(4);
  });

  it('意識で確定した II類は全5ステップが評価され、評価不要はゼロ', () => {
    const e = explain(BASE, JP_FDMA);

    expect(e.category).toBe('II');
    expect(e.steps.map((s) => s.status)).toEqual(['passed', 'passed', 'passed', 'passed', 'decided']);
    expect(e.skippedCount).toBe(0);
  });

  it('呼吸数で確定した I類は循環と意識が評価不要', () => {
    const e = explain(make({ respiratoryRate: 34 }), JP_FDMA);

    expect(e.category).toBe('I');
    expect(e.decidingStep).toBe('respiratoryRate');
    const byStep = new Map(e.steps.map((s) => [s.step, s.status]));
    expect(byStep.get('walk')).toBe('passed');
    expect(byStep.get('airway')).toBe('passed');
    expect(byStep.get('respiratoryRate')).toBe('decided');
    expect(byStep.get('circulation')).toBe('skipped');
    expect(byStep.get('consciousness')).toBe('skipped');
    expect(e.skippedCount).toBe(2);
  });

  it('ステップはフローの順序どおりに並ぶ', () => {
    const e = explain(BASE, JP_FDMA);
    expect(e.steps.map((s) => s.step)).toEqual([...DECIDING_STEPS]);
  });

  it('確定ステップはちょうど1つ', () => {
    const rng = createRng('explain-single-decided');
    for (let i = 0; i < 1000; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const g = generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng);
      const e = explain(g.case, JP_FDMA);
      expect(e.steps.filter((s) => s.status === 'decided')).toHaveLength(1);
    }
  });
});

describe('explain: 気道確保ステップは2つの観察を保持する', () => {
  it('0類は「自発呼吸なし」と「気道確保後も再開せず」の両方を提示する', () => {
    const e = explain(
      make({ hasSpontaneousBreathing: false, breathingAfterAirway: false, respiratoryRate: 0, obeysCommands: false }),
      JP_FDMA,
    );

    const airway = e.steps.find((s) => s.step === 'airway');
    expect(airway?.status).toBe('decided');
    expect(airway?.details.map((d) => d.key)).toEqual([
      'rationale.noBreathing',
      'rationale.breathingNotResumed',
    ]);
  });

  it('I類（気道確保で再開）も両方の観察を提示する', () => {
    const e = explain(
      make({ hasSpontaneousBreathing: false, breathingAfterAirway: true, respiratoryRate: 0, obeysCommands: false }),
      JP_FDMA,
    );

    const airway = e.steps.find((s) => s.step === 'airway');
    expect(airway?.details.map((d) => d.key)).toEqual(['rationale.noBreathing', 'rationale.breathingResumed']);
  });
});

describe('explain: 観察の内容', () => {
  it('評価不要なステップは観察を持たない', () => {
    const rng = createRng('explain-skipped-empty');
    for (let i = 0; i < 1000; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const e = explain(generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng).case, JP_FDMA);
      for (const step of e.steps) {
        if (step.status === 'skipped') expect(step.details).toEqual([]);
        else expect(step.details.length).toBeGreaterThan(0);
      }
    }
  });

  it('観察に実測値と閾値が載る（表示層が文章化できる）', () => {
    const e = explain(make({ respiratoryRate: 32 }), JP_FDMA);
    const rr = e.steps.find((s) => s.step === 'respiratoryRate');
    expect(rr?.details[0]).toEqual({ key: 'rationale.rrHigh', params: { rr: 32, threshold: 30 } });
  });

  it('結論に区分と確定ステップが載る', () => {
    const e = explain(make({ crtSeconds: 2.4 }), JP_FDMA);
    expect(e.conclusion).toEqual({ key: CONCLUSION_KEY, params: { category: 'I', step: 'circulation' } });
  });
});

describe('explain: 表示文字列を返さない（docs/I18N.md §5）', () => {
  it('返り値に日本語・英語の文章が含まれない', () => {
    const rng = createRng('explain-no-strings');
    for (let i = 0; i < 500; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const e = explain(generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng).case, JP_FDMA);

      for (const step of e.steps) {
        for (const d of step.details) {
          // キーは必ず 'rationale.' 接頭辞を持つ識別子であり、文章ではない
          expect(d.key).toMatch(/^rationale\.[A-Za-z]+$/);
        }
      }
      expect(e.conclusion.key).toMatch(/^explain\.[A-Za-z]+$/);
    }
  });

  it('日本語文字を一切含まない', () => {
    const rng = createRng('explain-no-japanese');
    for (let i = 0; i < 200; i++) {
      const g = generateCase({ target: 'I' }, rng);
      const serialized = JSON.stringify(explain(g.case, JP_FDMA));
      // ひらがな・カタカナ・漢字が現れたら、ドメイン層に表示文字列が混入している
      expect(serialized).not.toMatch(/[぀-ヿ一-龯]/);
    }
  });
});
