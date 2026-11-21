import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PatientFigure } from '@/components/patients';
import { BREATH_AMPLITUDE, breathAnimationFor, effectiveRateOf } from '@/components/patients/breathing';
import { FIGURES } from '@/components/patients/figures';
import { AGONAL_MAX_RATE, GASPS_PER_LOOP, breathCycleSeconds } from '@/domain/breathing';
import { ILLUSTRATIONS } from '@/domain/illustrations';
import { VALID_COMBINATIONS, generateCase } from '@/domain/generator';
import { createRng } from '@/domain/rng';
import { I18nProvider } from '@/i18n';
import type { TriageCase } from '@/domain/types';

const BASE: TriageCase = {
  id: 'figure-test',
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

function setReducedMotion(reduce: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function renderFigure(c: TriageCase, animate = true) {
  const { container } = render(
    <I18nProvider>
      <PatientFigure case={c} animate={animate} />
    </I18nProvider>,
  );
  const chest = container.querySelector('[data-breathing-pattern]');
  if (chest === null) throw new Error('胸郭グループが描画されていない');
  return { container, chest };
}

beforeEach(() => {
  localStorage.clear();
  // jsdom の navigator.language は en-US のため、初期言語を明示する
  window.history.replaceState(null, '', '/?lang=ja');
  setReducedMotion(false);
});

describe('カタログとコンポーネントの対応（SPEC §3.4）', () => {
  it('ILLUSTRATIONS の全 id に対応する図形が存在する', () => {
    const missing = ILLUSTRATIONS.map((i) => i.id).filter((id) => !(id in FIGURES));
    expect(missing).toEqual([]);
  });

  it('FIGURES に余剰の id が存在しない', () => {
    const catalogIds = new Set(ILLUSTRATIONS.map((i) => i.id));
    const extra = Object.keys(FIGURES).filter((id) => !catalogIds.has(id));
    expect(extra).toEqual([]);
  });

  it('13種すべてが実装されている', () => {
    expect(Object.keys(FIGURES)).toHaveLength(13);
    expect(ILLUSTRATIONS).toHaveLength(13);
  });

  it('全13種が例外なく描画でき、胸郭グループを持つ', () => {
    for (const illustration of ILLUSTRATIONS) {
      const { chest } = renderFigure(
        make({
          patient: { illustrationId: illustration.id, situationKey: illustration.situationKey },
          canWalk: illustration.canWalk,
        }),
      );
      expect(chest, illustration.id).toBeTruthy();
      expect(chest.querySelector('.torso'), `${illustration.id}: 胸郭の図形がない`).toBeTruthy();
    }
  });

  it('未実装のイラストIDは黙って無視せず失敗する', () => {
    expect(() =>
      renderFigure(make({ patient: { illustrationId: 'no-such-figure', situationKey: 'situation.lyingStill' } })),
    ).toThrow(/未実装/);
  });
});

describe('アニメーション精度（docs/OBSERVATION.md §3.2）', () => {
  it('呼吸数30の症例で animation-duration が 2s になる', () => {
    const { chest } = renderFigure(make({ respiratoryRate: 30 }));
    expect(chest.getAttribute('style')).toContain('animation-duration: 2s');
  });

  it('呼吸数20で3s、呼吸数15で4s', () => {
    expect(renderFigure(make({ respiratoryRate: 20 })).chest.getAttribute('style')).toContain(
      'animation-duration: 3s',
    );
    expect(renderFigure(make({ respiratoryRate: 15 })).chest.getAttribute('style')).toContain(
      'animation-duration: 4s',
    );
  });

  it('アニメーションが表現するレートが真の呼吸数と厳密に一致する', () => {
    for (let rr = 1; rr <= 44; rr++) {
      const c = make({ respiratoryRate: rr });
      const pattern = rr <= AGONAL_MAX_RATE ? 'agonal' : rr >= 30 ? 'rapidShallow' : 'normal';
      const animation = breathAnimationFor(pattern, c.respiratoryRate);
      expect(animation, `rr=${rr}`).not.toBeNull();
      expect(effectiveRateOf(animation!), `rr=${rr}`).toBeCloseTo(rr, 10);
    }
  });

  it('死戦期呼吸のループは 3 × 呼吸周期 で、平均レートが呼吸数と一致する', () => {
    for (let rr = 1; rr <= AGONAL_MAX_RATE; rr++) {
      const animation = breathAnimationFor('agonal', rr);
      expect(animation?.breathsPerLoop).toBe(GASPS_PER_LOOP);
      expect(animation?.durationSeconds).toBeCloseTo(GASPS_PER_LOOP * breathCycleSeconds(rr), 10);
      expect(effectiveRateOf(animation!)).toBeCloseTo(rr, 10);
    }
  });

  it('死戦期呼吸は専用のキーフレームを使う', () => {
    const { chest } = renderFigure(make({ respiratoryRate: 5 }));
    expect(chest.getAttribute('class')).toContain('chest--agonal');
    expect(chest.getAttribute('data-breathing-pattern')).toBe('agonal');
    // 呼吸数5 → 周期12秒 → ループ36秒
    expect(chest.getAttribute('style')).toContain('animation-duration: 36s');
  });

  it('規則呼吸は死戦期用のキーフレームを使わない', () => {
    const { chest } = renderFigure(make({ respiratoryRate: 18 }));
    expect(chest.getAttribute('class')).toBe('chest');
    expect(chest.getAttribute('class')).not.toContain('agonal');
  });
});

describe('振幅', () => {
  it('浅く速い < 規則的 < 深い喘ぎ の関係を保つ', () => {
    expect(BREATH_AMPLITUDE.rapidShallow).toBeLessThan(BREATH_AMPLITUDE.normal);
    expect(BREATH_AMPLITUDE.normal).toBeLessThan(BREATH_AMPLITUDE.agonal);
  });

  it('パターンに応じた振幅が CSS 変数で渡される', () => {
    expect(renderFigure(make({ respiratoryRate: 36 })).chest.getAttribute('style')).toContain(
      `--breath-amp: ${BREATH_AMPLITUDE.rapidShallow}`,
    );
    expect(renderFigure(make({ respiratoryRate: 18 })).chest.getAttribute('style')).toContain(
      `--breath-amp: ${BREATH_AMPLITUDE.normal}`,
    );
    expect(renderFigure(make({ respiratoryRate: 5 })).chest.getAttribute('style')).toContain(
      `--breath-amp: ${BREATH_AMPLITUDE.agonal}`,
    );
  });
});

describe('無呼吸は静止そのものが手がかり（docs/OBSERVATION.md §4）', () => {
  const apneic = make({
    hasSpontaneousBreathing: false,
    breathingAfterAirway: false,
    respiratoryRate: 0,
    obeysCommands: false,
  });

  it('アニメーションを一切付与しない', () => {
    const { chest } = renderFigure(apneic);
    expect(chest.getAttribute('class')).toBeNull();
    expect(chest.getAttribute('style')).toBeNull();
    expect(chest.getAttribute('data-breathing-pattern')).toBe('apneic');
  });

  it('breathAnimationFor は null を返す', () => {
    expect(breathAnimationFor('apneic', 0)).toBeNull();
    expect(breathAnimationFor('apneic', null)).toBeNull();
  });

  it('気道確保で呼吸が再開する症例も、提示時点では静止している', () => {
    const { chest } = renderFigure(make({ ...apneic, breathingAfterAirway: true }));
    expect(chest.getAttribute('class')).toBeNull();
    expect(chest.getAttribute('data-breathing-pattern')).toBe('apneic');
  });
});

describe('動きだけで情報を伝えない（SPEC §5.3）', () => {
  it('prefers-reduced-motion が有効なら動かさない', () => {
    setReducedMotion(true);
    const { chest } = renderFigure(make({ respiratoryRate: 30 }));
    expect(chest.getAttribute('class')).toBeNull();
    expect(chest.getAttribute('style')).toBeNull();
  });

  it('reduced-motion でもパターンは data 属性として残る（表示層が数値提示に使う）', () => {
    setReducedMotion(true);
    const { chest } = renderFigure(make({ respiratoryRate: 36 }));
    expect(chest.getAttribute('data-breathing-pattern')).toBe('rapidShallow');
  });

  it('数値モード（animate=false）では動かさない', () => {
    const { chest } = renderFigure(make({ respiratoryRate: 30 }), false);
    expect(chest.getAttribute('class')).toBeNull();
    expect(chest.getAttribute('style')).toBeNull();
  });
});

describe('アクセシビリティ', () => {
  it('role=img と中立な aria-label を持つ', () => {
    const { container } = renderFigure(BASE);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('傷病者のイラスト');
  });

  it('aria-label が言語に追従する', () => {
    window.history.replaceState(null, '', '/?lang=en');
    const { container } = renderFigure(BASE);
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Illustration of a casualty');
  });

  it('aria-label が答えを漏らさない', () => {
    // 歩行可否・呼吸の有無・区分を示す語を含まないこと
    const leaky = ['歩行', '呼吸', '赤', '黄', '緑', '黒', '緊急', '死亡', 'walk', 'breath'];
    for (const illustration of ILLUSTRATIONS) {
      const { container } = renderFigure(
        make({
          patient: { illustrationId: illustration.id, situationKey: illustration.situationKey },
          canWalk: illustration.canWalk,
        }),
      );
      const label = container.querySelector('svg')?.getAttribute('aria-label') ?? '';
      for (const word of leaky) {
        expect(label.toLowerCase(), `${illustration.id}: aria-label が ${word} を漏らしている`).not.toContain(
          word.toLowerCase(),
        );
      }
    }
  });
});

describe('生成した全症例が描画できる', () => {
  it('全組み合わせの症例でアニメーション属性が矛盾しない', () => {
    const rng = createRng('figure-smoke');
    for (let i = 0; i < 200; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const g = generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng);
      const { chest } = renderFigure(g.case);

      const pattern = chest.getAttribute('data-breathing-pattern');
      if (pattern === 'apneic') {
        expect(chest.getAttribute('style'), JSON.stringify(g.case)).toBeNull();
      } else {
        // 呼吸しているなら必ず周期が設定されている
        expect(chest.getAttribute('style'), JSON.stringify(g.case)).toMatch(/animation-duration: [\d.]+s/);
      }
    }
  });
});
