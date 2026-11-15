/**
 * シード付き擬似乱数生成器。
 *
 * 症例生成を再現可能にするために使う。テストで失敗したシードをそのまま再現できることが重要。
 * `Math.random()` を直接使わないため、不変条件テスト（tests/generator.spec.ts）が決定的になる。
 *
 * アルゴリズムは sfc32 + 文字列ハッシュ。暗号用途ではない。
 */
export interface Rng {
  /** [0, 1) の浮動小数 */
  next(): number;
  /** [min, max] の整数（両端含む） */
  int(min: number, max: number): number;
  /** [min, max] を step 刻みで丸めた小数 */
  decimal(min: number, max: number, step: number): number;
  /** 確率 p (0..1) で true */
  chance(p: number): boolean;
  /** 配列から1つ選ぶ。空配列はエラー */
  pick<T>(items: readonly T[]): T;
  /** 新しい配列を返すシャッフル（Fisher-Yates） */
  shuffle<T>(items: readonly T[]): T[];
}

function hashSeed(seed: string): [number, number, number, number] {
  // cyrb128
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

export function createRng(seed: string): Rng {
  let [a, b, c, d] = hashSeed(seed);

  const next = (): number => {
    // sfc32
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };

  // 初期状態の偏りを捨てる
  for (let i = 0; i < 12; i++) next();

  const int = (min: number, max: number): number => {
    if (max < min) throw new Error(`rng.int: max(${max}) < min(${min})`);
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    int,
    decimal: (min, max, step) => {
      const steps = Math.round((max - min) / step);
      // 浮動小数の累積誤差を避けるため、step 単位の整数で抽選してから戻す
      const value = min + int(0, steps) * step;
      const decimals = Math.max(0, -Math.floor(Math.log10(step)));
      return Number(value.toFixed(decimals));
    },
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('rng.pick: 空配列から選択できない');
      // noUncheckedIndexedAccess 下でも安全。長さを検査済み
      return items[int(0, items.length - 1)] as (typeof items)[number];
    },
    shuffle: (items) => {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i--) {
        const j = int(0, i);
        const a0 = result[i] as (typeof result)[number];
        const b0 = result[j] as (typeof result)[number];
        result[i] = b0;
        result[j] = a0;
      }
      return result;
    },
  };
}
