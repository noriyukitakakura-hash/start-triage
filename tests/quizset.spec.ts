import { describe, expect, it } from 'vitest';
import { judge } from '@/domain/judge';
import {
  QUIZ_COMPOSITION,
  QUIZ_LENGTH,
  QUIZ_MIN_BOUNDARY,
  boundaryCapableStepsFor,
  canUseBoundary,
  generateQuizSet,
} from '@/domain/generator';
import { JP_FDMA } from '@/domain/profiles';
import { createRng } from '@/domain/rng';
import type { Category } from '@/domain/types';

function tally(categories: Category[]): Record<Category, number> {
  const t: Record<Category, number> = { I: 0, II: 0, III: 0, '0': 0 };
  for (const c of categories) t[c]++;
  return t;
}

const SETS = 400;

describe('generateQuizSet: 構成（SPEC §2.4）', () => {
  it('必ず10問生成する', () => {
    const rng = createRng('quiz-length');
    for (let i = 0; i < SETS; i++) {
      expect(generateQuizSet(rng)).toHaveLength(QUIZ_LENGTH);
    }
  });

  it('固定構成 I類4 / II類2 / III類2 / 0類1 を必ず満たす（+ランダム1）', () => {
    const rng = createRng('quiz-composition');
    const fixed = tally([...QUIZ_COMPOSITION]);

    for (let i = 0; i < SETS; i++) {
      const actual = tally(generateQuizSet(rng).map((g) => judge(g.case, JP_FDMA).category));
      // 各区分は固定構成を下回らず、ランダム1問分だけ上回り得る
      for (const c of ['I', 'II', 'III', '0'] as const) {
        expect(actual[c], `区分 ${c} が固定構成を下回った`).toBeGreaterThanOrEqual(fixed[c]);
        expect(actual[c], `区分 ${c} が固定構成を2問以上上回った`).toBeLessThanOrEqual(fixed[c] + 1);
      }
      expect(Object.values(actual).reduce((a, b) => a + b, 0)).toBe(QUIZ_LENGTH);
    }
  });

  it('ランダム1問により全区分が増える可能性がある', () => {
    const rng = createRng('quiz-random-slot');
    const fixed = tally([...QUIZ_COMPOSITION]);
    const extraSeen = new Set<Category>();

    for (let i = 0; i < SETS; i++) {
      const actual = tally(generateQuizSet(rng).map((g) => judge(g.case, JP_FDMA).category));
      for (const c of ['I', 'II', 'III', '0'] as const) {
        if (actual[c] === fixed[c] + 1) extraSeen.add(c);
      }
    }
    expect([...extraSeen].sort()).toEqual(['0', 'I', 'II', 'III']);
  });

  it('出題順がシャッフルされる', () => {
    const rng = createRng('quiz-shuffle');
    const orders = new Set<string>();
    for (let i = 0; i < 50; i++) {
      orders.add(generateQuizSet(rng).map((g) => g.target).join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('generateQuizSet: 境界値の下限（SPEC §2.4）', () => {
  it(`必ず${QUIZ_MIN_BOUNDARY}問以上が境界値症例になる`, () => {
    const rng = createRng('quiz-boundary');
    for (let i = 0; i < SETS; i++) {
      const set = generateQuizSet(rng);
      const boundary = set.filter((g) => g.usedBoundary).length;
      expect(boundary, `境界値症例が${boundary}問しかない`).toBeGreaterThanOrEqual(QUIZ_MIN_BOUNDARY);
    }
  });

  it('boundaryRate=0 でも下限は満たされる（不足分を差し替えるため）', () => {
    const rng = createRng('quiz-boundary-zero');
    for (let i = 0; i < SETS; i++) {
      const set = generateQuizSet(rng, { boundaryRate: 0 });
      expect(set.filter((g) => g.usedBoundary).length).toBeGreaterThanOrEqual(QUIZ_MIN_BOUNDARY);
    }
  });

  it('差し替えても区分の構成は崩れない', () => {
    const rng = createRng('quiz-boundary-keeps-composition');
    const fixed = tally([...QUIZ_COMPOSITION]);
    for (let i = 0; i < SETS; i++) {
      const actual = tally(generateQuizSet(rng, { boundaryRate: 0 }).map((g) => judge(g.case, JP_FDMA).category));
      for (const c of ['I', 'II', 'III', '0'] as const) {
        expect(actual[c]).toBeGreaterThanOrEqual(fixed[c]);
        expect(actual[c]).toBeLessThanOrEqual(fixed[c] + 1);
      }
    }
  });

  it('境界値の下限が構造的に達成可能である（I類4 + II類2 = 6問 ≧ 4問）', () => {
    // III類は walk、0類は airway でしか確定せず境界値を持ち得ない。
    // 下限を満たせるのは I類・II類の6問のみであり、これが下限を上回っている必要がある
    const capable = [...QUIZ_COMPOSITION].filter((c) => boundaryCapableStepsFor(c).length > 0).length;
    expect(capable).toBe(6);
    expect(capable).toBeGreaterThanOrEqual(QUIZ_MIN_BOUNDARY);

    expect(boundaryCapableStepsFor('III')).toEqual([]);
    expect(boundaryCapableStepsFor('0')).toEqual([]);
    expect(boundaryCapableStepsFor('II')).toEqual(['consciousness']);
    expect(boundaryCapableStepsFor('I').sort()).toEqual(['circulation', 'consciousness', 'respiratoryRate']);
  });

  it('境界値を取り得ないステップは境界値症例として数えない', () => {
    const rng = createRng('quiz-boundary-flag');
    for (let i = 0; i < SETS; i++) {
      for (const g of generateQuizSet(rng)) {
        if (!canUseBoundary(g.decidingStep)) {
          expect(g.usedBoundary, `${g.decidingStep} は境界値を持ち得ない`).toBe(false);
        }
      }
    }
  });
});

describe('generateQuizSet: 不変条件', () => {
  it('全症例が judge で target どおりに判定される', () => {
    const rng = createRng('quiz-invariant');
    for (let i = 0; i < SETS; i++) {
      for (const g of generateQuizSet(rng)) {
        const j = judge(g.case, JP_FDMA);
        expect(j.category, JSON.stringify(g.case)).toBe(g.target);
        expect(j.decidingStep, JSON.stringify(g.case)).toBe(g.decidingStep);
      }
    }
  });

  it('症例IDが一意である', () => {
    const rng = createRng('quiz-ids');
    for (let i = 0; i < SETS; i++) {
      const ids = generateQuizSet(rng).map((g) => g.case.id);
      expect(new Set(ids).size).toBe(QUIZ_LENGTH);
    }
  });

  it('同一シードは同一の10問を生成する', () => {
    const a = generateQuizSet(createRng('quiz-determinism'));
    const b = generateQuizSet(createRng('quiz-determinism'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
