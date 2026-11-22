import { describe, expect, it } from 'vitest';
import {
  AMBIGUOUS_ILLUSTRATIONS,
  ALL_SITUATION_KEYS,
  ILLUSTRATIONS,
  NON_WALKABLE_ILLUSTRATIONS,
  POSES,
  WALKABLE_ILLUSTRATIONS,
  illustrationById,
} from '@/domain/illustrations';

/**
 * イラストカタログの不変条件（SPEC §3.4）。
 *
 * カタログは**状況文が歩行可否の唯一の決め手**であるという設計に乗っている。
 * その前提が崩れる書き方（同じ文が両方の区分で使われる等）を機械で防ぐ。
 */

describe('カタログの一意性', () => {
  it('id が重複しない', () => {
    const ids = ILLUSTRATIONS.map((i) => i.id);
    expect(new Set(ids).size, `重複した id がある: ${ids.join(', ')}`).toBe(ids.length);
  });

  it('各イラストが状況文を1つ以上持ち、イラスト内で重複しない', () => {
    for (const illustration of ILLUSTRATIONS) {
      expect(illustration.situationKeys.length, `${illustration.id}: 状況文がない`).toBeGreaterThan(0);
      expect(
        new Set(illustration.situationKeys).size,
        `${illustration.id}: 状況文が重複している`,
      ).toBe(illustration.situationKeys.length);
    }
  });

  it('状況文キーがカタログ全体で一意である', () => {
    // **状況文が歩行可否の決め手**なので、同じ文が2箇所に現れると
    // 一つの文が「歩ける」と「歩けない」の両方を意味し得てしまう
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const illustration of ILLUSTRATIONS) {
      for (const key of illustration.situationKeys) {
        const owner = seen.get(key);
        if (owner !== undefined) clashes.push(`${key} (${owner} と ${illustration.id})`);
        seen.set(key, illustration.id);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('ALL_SITUATION_KEYS が全キーを網羅する', () => {
    expect(new Set(ALL_SITUATION_KEYS).size).toBe(ALL_SITUATION_KEYS.length);
    expect(ALL_SITUATION_KEYS.length).toBe(ILLUSTRATIONS.reduce((n, i) => n + i.situationKeys.length, 0));
  });

  it('歩行可能と歩行不能の和がカタログ全体になる', () => {
    expect(WALKABLE_ILLUSTRATIONS.length + NON_WALKABLE_ILLUSTRATIONS.length).toBe(ILLUSTRATIONS.length);
  });

  it('illustrationById が引ける', () => {
    for (const illustration of ILLUSTRATIONS) {
      expect(illustrationById(illustration.id)).toBe(illustration);
    }
    expect(illustrationById('no-such-id')).toBeUndefined();
  });
});

describe('姿勢と、絵だけでは決められない症例', () => {
  it('全イラストの pose が POSES に含まれる', () => {
    for (const illustration of ILLUSTRATIONS) {
      expect(POSES, `${illustration.id}: 未知の pose`).toContain(illustration.pose);
    }
  });

  it('使われていない pose がない', () => {
    const used = new Set(ILLUSTRATIONS.map((i) => i.pose));
    expect(POSES.filter((p) => !used.has(p))).toEqual([]);
  });

  /**
   * 歩行可・歩行不能の両方に現れる姿勢は、**絵が答えを決めない**ことを意味する。
   * 増やすのは意図的な設計判断なので、明示した一覧と一致させて不意の追加を防ぐ。
   */
  it('絵だけでは決められないイラストが、意図した一覧と一致する', () => {
    const expected = ['standing-waving', 'standing-unable'];
    expect(AMBIGUOUS_ILLUSTRATIONS.map((i) => i.id).sort()).toEqual([...expected].sort());
  });

  it('絵だけでは決められない症例が多すぎない', () => {
    // 多すぎると「絵を疑う」反射を教えてしまい、引っかけ問題集になる。
    // 残りの大半では絵が手がかりとして機能していなければならない
    for (const [name, bucket] of [
      ['歩行可能', WALKABLE_ILLUSTRATIONS],
      ['歩行不能', NON_WALKABLE_ILLUSTRATIONS],
    ] as const) {
      const ambiguous = bucket.filter((i) => AMBIGUOUS_ILLUSTRATIONS.includes(i)).length;
      expect(ambiguous / bucket.length, `${name}: 紛らわしい症例の比率が高すぎる`).toBeLessThanOrEqual(0.4);
    }
  });
});
