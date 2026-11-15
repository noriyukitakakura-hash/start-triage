import { describe, expect, it } from 'vitest';
import { createRng } from '@/domain/rng';

describe('createRng: 決定性', () => {
  it('同一シードは同一の数列を生成する', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-1');
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('異なるシードは異なる数列を生成する', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-2');
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });
});

describe('createRng: 値域', () => {
  it('next() は [0, 1) に収まる', () => {
    const rng = createRng('range');
    for (let i = 0; i < 20000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(min, max) は両端を含み、外に出ない', () => {
    const rng = createRng('int');
    const seen = new Set<number>();
    for (let i = 0; i < 20000; i++) {
      const v = rng.int(10, 29);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(29);
      seen.add(v);
    }
    // 20要素すべてが出現する（両端含む）
    expect(seen.size).toBe(20);
    expect(seen.has(10)).toBe(true);
    expect(seen.has(29)).toBe(true);
  });

  it('int(n, n) は n を返す', () => {
    const rng = createRng('single');
    expect(rng.int(7, 7)).toBe(7);
  });

  it('max < min はエラー', () => {
    expect(() => createRng('x').int(5, 4)).toThrow();
  });

  it('decimal は step 刻みの値を返し、浮動小数誤差を持たない', () => {
    const rng = createRng('decimal');
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = rng.decimal(1.0, 1.9, 0.1);
      expect(v).toBeGreaterThanOrEqual(1.0);
      expect(v).toBeLessThanOrEqual(1.9);
      // 1.2000000000000002 のような値を生成しない
      expect(v).toBe(Number(v.toFixed(1)));
      seen.add(v);
    }
    expect(seen.size).toBe(10);
  });
});

describe('createRng: chance', () => {
  it('p=0 は常に false、p=1 は常に true', () => {
    const rng = createRng('chance');
    for (let i = 0; i < 1000; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('p=0.35 の実測頻度が概ね 35% になる', () => {
    const rng = createRng('chance-dist');
    const n = 100000;
    let hits = 0;
    for (let i = 0; i < n; i++) if (rng.chance(0.35)) hits++;
    expect(hits / n).toBeGreaterThan(0.34);
    expect(hits / n).toBeLessThan(0.36);
  });
});

describe('createRng: pick / shuffle', () => {
  it('pick は要素のいずれかを返し、全要素が出現し得る', () => {
    const rng = createRng('pick');
    const items = ['a', 'b', 'c', 'd'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(rng.pick(items));
    expect([...seen].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('pick は空配列でエラー', () => {
    expect(() => createRng('x').pick([])).toThrow();
  });

  it('shuffle は元配列を変更せず、要素を保存する', () => {
    const rng = createRng('shuffle');
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const frozen = [...original];
    const shuffled = rng.shuffle(original);

    expect(original).toEqual(frozen);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(frozen);
  });

  it('shuffle は実際に順序を変える', () => {
    const rng = createRng('shuffle-order');
    const original = Array.from({ length: 20 }, (_, i) => i);
    const results = Array.from({ length: 10 }, () => rng.shuffle(original).join(','));
    expect(results.some((r) => r !== original.join(','))).toBe(true);
  });
});
