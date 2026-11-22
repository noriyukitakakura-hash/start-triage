import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BUILD_SCALES, HAIR_STYLES, appearanceFor } from '@/components/patients/appearance';
import { PatientFigure } from '@/components/patients';
import { generateCase } from '@/domain/generator';
import { createRng } from '@/domain/rng';
import { I18nProvider } from '@/i18n';
import { CATEGORIES, type Category, type TriageCase } from '@/domain/types';

/**
 * 見た目の個体差（SPEC §3.4）。
 *
 * **見た目は判定に一切関わってはならない。** 体格や髪型が歩行可否と相関すると、
 * 利用者はフローではなく見た目で答えるようになる。ここはそれを数で確かめる。
 */

const BASE: TriageCase = {
  id: 'appearance',
  patient: { illustrationId: 'supine-still', situationKey: 'situation.lyingStill' },
  canWalk: false,
  hasSpontaneousBreathing: true,
  breathingAfterAirway: null,
  respiratoryRate: 20,
  radialPulsePalpable: true,
  pulseRate: 88,
  crtSeconds: 1.2,
  obeysCommands: true,
  nonObeyingResponse: null,
};

function renderFigure(c: TriageCase) {
  const { container } = render(
    <I18nProvider>
      <PatientFigure case={c} animate />
    </I18nProvider>,
  );
  return container;
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/?lang=ja');
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

describe('appearanceFor', () => {
  it('同じ症例IDには必ず同じ見た目を返す', () => {
    // 描画のたびに姿が変わると、計測の途中で別人になってしまう
    for (const id of ['case-1', 'quiz-7', 'あ', '']) {
      expect(appearanceFor(id)).toEqual(appearanceFor(id));
    }
  });

  it('返す値が定義域に収まる', () => {
    for (let i = 0; i < 500; i++) {
      const a = appearanceFor(`case-${i}`);
      expect(HAIR_STYLES).toContain(a.hair);
      expect(BUILD_SCALES).toContain(a.buildScale);
    }
  });

  it('髪型も体格も全種類が現れる', () => {
    const hair = new Set<string>();
    const build = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const a = appearanceFor(`case-${i}`);
      hair.add(a.hair);
      build.add(a.buildScale);
    }
    expect([...hair].sort()).toEqual([...HAIR_STYLES].sort());
    expect([...build].sort()).toEqual([...BUILD_SCALES].sort());
  });

  it('髪型と体格が互いに相関しない', () => {
    // 同じ値から両方を導くと「大柄な人は必ず同じ髪型」になってしまう
    const pairs = new Set<string>();
    for (let i = 0; i < 2_000; i++) {
      const a = appearanceFor(`case-${i}`);
      pairs.add(`${a.hair}/${a.buildScale}`);
    }
    expect(pairs.size).toBe(HAIR_STYLES.length * BUILD_SCALES.length);
  });
});

describe('見た目は答えを漏らさない', () => {
  it('どの髪型も体格も、歩行可・歩行不能の両方に現れる', () => {
    const rng = createRng('appearance-independence');
    const seen = new Map<string, Set<boolean>>();

    for (let i = 0; i < 4_000; i++) {
      const g = generateCase({ target: CATEGORIES[i % CATEGORIES.length] as Category }, rng);
      const a = appearanceFor(g.case.id);
      for (const key of [`hair:${a.hair}`, `build:${a.buildScale}`]) {
        const set = seen.get(key) ?? new Set<boolean>();
        set.add(g.case.canWalk);
        seen.set(key, set);
      }
    }

    for (const [key, values] of seen) {
      expect(values.size, `${key} が歩行可否の片方にしか現れない`).toBe(2);
    }
  });

  it('同じイラストでも複数の髪型が現れる', () => {
    // 見た目をイラストから導いてしまっていないことの確認
    const rng = createRng('appearance-per-figure');
    const byFigure = new Map<string, Set<string>>();

    for (let i = 0; i < 4_000; i++) {
      const g = generateCase({ target: CATEGORIES[i % CATEGORIES.length] as Category }, rng);
      const set = byFigure.get(g.case.patient.illustrationId) ?? new Set<string>();
      set.add(appearanceFor(g.case.id).hair);
      byFigure.set(g.case.patient.illustrationId, set);
    }

    for (const [figure, hair] of byFigure) {
      expect(hair.size, `${figure}: 髪型が1種類しか出ていない`).toBeGreaterThan(1);
    }
  });
});

describe('個体差が呼吸アニメーションを壊さない', () => {
  it('体格が変わっても周期と振幅が変わらない', () => {
    /*
      `.chest` は `transform-box: fill-box` なので、`transform-origin: center bottom` は
      その要素自身のローカル座標系で解決される。祖先に拡縮を掛けても影響しない
    */
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const container = renderFigure({ ...BASE, id: `case-${i}` });
      const chest = container.querySelector('[data-breathing-pattern]') as HTMLElement;
      seen.add(`${chest.style.animationDuration}/${chest.style.getPropertyValue('--breath-amp')}`);
    }
    expect([...seen]).toEqual(['3s/1.12']);
  });

  it('`.chest` 自身は決して変形されない', () => {
    for (let i = 0; i < 60; i++) {
      const container = renderFigure({ ...BASE, id: `case-${i}` });
      const chest = container.querySelector('[data-breathing-pattern]') as Element;
      expect(chest.getAttribute('transform'), '胸郭自身を変形すると挙上の向きが狂う').toBeNull();
    }
  });

  it('拡縮は人物だけに掛かり、地面には掛からない', () => {
    // 人物が大柄でも地面まで広がっては意味が変わる
    const large = [...Array(200).keys()]
      .map((i) => `case-${i}`)
      .find((id) => appearanceFor(id).buildScale !== 1);
    expect(large, '拡縮される症例IDが見つからない').toBeDefined();

    const container = renderFigure({ ...BASE, id: large as string });
    const ground = container.querySelector('line.ground') as Element;
    expect(ground.closest('g[transform]'), '地面が拡縮の内側にある').toBeNull();
  });
});
