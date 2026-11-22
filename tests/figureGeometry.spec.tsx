import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PatientFigure } from '@/components/patients';
import { BREATH_AMPLITUDE } from '@/components/patients/breathing';
import { HAIR_STYLES, appearanceFor, type HairStyle } from '@/components/patients/appearance';
import { ILLUSTRATIONS } from '@/domain/illustrations';
import { I18nProvider } from '@/i18n';
import type { TriageCase } from '@/domain/types';

/**
 * 胸郭の契約を**目視ではなく幾何で**担保する（docs/OBSERVATION.md §5）。
 *
 * 「四肢を胸郭に重ねない」は見た目の問題ではなく実測モードの機能要件である。
 * 動くのは胸郭だけなので、腕が被ると呼吸の動きが隠れて数えられなくなる。
 * 実際に一度その不具合を出しており、イラストが増えるほど目では守り切れない。
 *
 * そこで描画結果の SVG から座標を読み取り、機械で検査する。
 */

/** 最大振幅（死戦期呼吸）。このとき胸郭の上端が最も持ち上がる */
const MAX_AMPLITUDE = BREATH_AMPLITUDE.agonal;

/**
 * 保護帯は胸郭の**上半分**と、そこから挙上で届く範囲。
 *
 * 下端は `transform-origin` なので変位しない。脚の付け根が底辺にかかるのは
 * 正常であり、そこまで禁止すると描けるポーズがなくなる。
 */
const GUARDED_FRACTION = 0.5;

/** 頭部と、最大挙上した胸郭との最小間隔 */
const MIN_HEAD_CLEARANCE = 2;

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BASE: TriageCase = {
  id: 'geometry',
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

function num(el: Element, name: string): number {
  const raw = el.getAttribute(name);
  if (raw === null) throw new Error(`属性 ${name} がない`);
  return Number.parseFloat(raw);
}

/** `rotate(deg cx cy)` を読む。無ければ回転なし */
function rotationOf(el: Element | null): { deg: number; cx: number; cy: number } | null {
  const transform = el?.getAttribute('transform');
  if (el === null || transform === null || transform === undefined) return null;
  const m = /rotate\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)/.exec(transform);
  if (m === null) return null;
  return { deg: Number(m[1]), cx: Number(m[2]), cy: Number(m[3]) };
}

/** 画面座標を胸郭のローカル座標へ戻す（回転の逆変換） */
function toChestFrame(p: Point, rotation: { deg: number; cx: number; cy: number } | null): Point {
  if (rotation === null) return p;
  const a = (-rotation.deg * Math.PI) / 180;
  const dx = p.x - rotation.cx;
  const dy = p.y - rotation.cy;
  return {
    x: rotation.cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: rotation.cy + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

/**
 * `M`/`L` だけで書かれた折れ線を点列にする。
 *
 * **四肢は曲線コマンドを使わない規約**であるため、これで全点を正確に拾える。
 * 曲線が混ざると制御点の外側を通り得るので、見つけたら失敗させる。
 */
function polylineOf(d: string): Point[] {
  const unsupported = /[CcSsQqTtAaHhVv]/.exec(d);
  if (unsupported !== null) {
    throw new Error(`四肢に曲線コマンド ${unsupported[0]} がある。M/L の折れ線で描くこと: ${d}`);
  }
  return [...d.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

/** 線分を等間隔に標本化する。端点だけでは辺を横切る中間点を見逃す */
function sample(points: Point[], step = 1): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a === undefined || b === undefined) continue;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k <= n; k++) {
      out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
  }
  return out.length > 0 ? out : points;
}

/** 矩形の内部にどれだけ食い込んでいるか。外なら 0 */
function penetration(p: Point, r: Rect): number {
  if (p.x <= r.x || p.x >= r.x + r.w || p.y <= r.y || p.y >= r.y + r.h) return 0;
  return Math.min(p.x - r.x, r.x + r.w - p.x, p.y - r.y, r.y + r.h - p.y);
}

/** 点と矩形の距離。内部なら 0 */
function distanceTo(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, p.x - (r.x + r.w), 0);
  const dy = Math.max(r.y - p.y, p.y - (r.y + r.h), 0);
  return Math.hypot(dx, dy);
}

interface Geometry {
  /** 最大挙上した胸郭（ローカル座標） */
  inflated: Rect;
  /** 保護帯。上半分＋挙上域 */
  guard: Rect;
  /** 四肢の標本点（ローカル座標） */
  limbPoints: Point[];
  /** 頭部と髪（ローカル座標）。髪も胸郭に食い込んではいけない */
  heads: { center: Point; r: number; what: string }[];
}

/**
 * その髪型になる症例IDを探す。
 * 見た目は症例IDから決まる（appearance.ts）ので、IDを選ぶことで髪型を指定できる
 */
const ID_FOR_HAIR = new Map<HairStyle, string>(
  HAIR_STYLES.map((hair) => {
    for (let i = 0; i < 1000; i++) {
      const id = `geometry-${i}`;
      if (appearanceFor(id).hair === hair) return [hair, id];
    }
    throw new Error(`髪型 ${hair} になる症例IDが見つからない`);
  }),
);

function geometryOf(illustrationId: string, situationKey: string, hair?: HairStyle): Geometry {
  const id = hair === undefined ? BASE.id : (ID_FOR_HAIR.get(hair) as string);
  const { container } = render(
    <I18nProvider>
      <PatientFigure case={{ ...BASE, id, patient: { illustrationId, situationKey } }} animate />
    </I18nProvider>,
  );

  const chestGroup = container.querySelector('[data-breathing-pattern]');
  if (chestGroup === null) throw new Error(`${illustrationId}: 胸郭グループがない`);

  const torsos = chestGroup.querySelectorAll('.torso');
  if (torsos.length !== 1) {
    throw new Error(`${illustrationId}: 胸郭は1つだけであること（${torsos.length} 個ある）`);
  }
  const torso = torsos[0] as Element;

  // 傾きは `.chest` の外側にある。内側にあると fill-box が狂う（PatientFigure 参照）
  expect(chestGroup.getAttribute('transform'), `${illustrationId}: .chest 自身を変形してはならない`).toBeNull();
  const rotation = rotationOf(chestGroup.parentElement);

  const x = num(torso, 'x');
  const y = num(torso, 'y');
  const w = num(torso, 'width');
  const h = num(torso, 'height');
  const lift = (MAX_AMPLITUDE - 1) * h;

  const limbPoints = [...container.querySelectorAll('path.limb')].flatMap((el) =>
    sample(polylineOf(el.getAttribute('d') ?? '')).map((p) => toChestFrame(p, rotation)),
  );

  /*
    頭部と髪はどちらも円。頸部は矩形なので拾われない（頸部は胸郭に接していてよい）。
    髪は頭部グループの中で `translate` されているので、親の移動量を足して図の座標へ戻す。
    体格の拡縮は一様なので、内外の関係を変えない。ここでは適用しなくてよい
  */
  const heads = [...container.querySelectorAll('circle.body, circle.hair')].map((el) => {
    const group = el.parentElement?.closest('g[transform^="translate"]');
    const t = /translate\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/.exec(group?.getAttribute('transform') ?? '');
    const ox = t === null ? 0 : Number(t[1]);
    const oy = t === null ? 0 : Number(t[2]);
    return {
      center: toChestFrame({ x: ox + num(el, 'cx'), y: oy + num(el, 'cy') }, rotation),
      r: num(el, 'r'),
      what: el.classList.contains('hair') ? '髪' : '頭部',
    };
  });

  return {
    inflated: { x, y: y - lift, w, h: h + lift },
    guard: { x, y: y - lift, w, h: lift + h * GUARDED_FRACTION },
    limbPoints,
    heads,
  };
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

describe('胸郭の契約（docs/OBSERVATION.md §5）', () => {
  it.each(ILLUSTRATIONS.map((i) => [i.id, i] as const))(
    '%s: 四肢が胸郭の動く範囲に重ならない',
    (id, illustration) => {
      const { guard, limbPoints } = geometryOf(id, illustration.situationKeys[0]);

      let worst = 0;
      let at: Point | null = null;
      for (const p of limbPoints) {
        const depth = penetration(p, guard);
        if (depth > worst) {
          worst = depth;
          at = p;
        }
      }

      expect(
        worst,
        `${id}: 四肢の中心線が胸郭の可動域に ${worst.toFixed(2)}px 入っている` +
          `（${at === null ? '' : `(${at.x.toFixed(1)}, ${at.y.toFixed(1)}) 付近`}）。` +
          '腕が被ると呼吸の動きが隠れて数えられなくなる',
      ).toBe(0);
    },
  );

  it.each(ILLUSTRATIONS.map((i) => [i.id, i] as const))(
    '%s: 最大挙上した胸郭が頭部にも髪にも食い込まない',
    (id, illustration) => {
      // 髪型は全種類を試す。頭頂側へずらした円なので胸郭側へは出ないはずだが、
      // それを前提にせず実際に測る
      const heads = HAIR_STYLES.flatMap((hair) => geometryOf(id, illustration.situationKeys[0], hair).heads);
      const { inflated } = geometryOf(id, illustration.situationKeys[0]);
      expect(heads.length, `${id}: 頭部が描かれていない`).toBeGreaterThan(0);

      for (const head of heads) {
        const clearance = distanceTo(head.center, inflated) - head.r;
        expect(
          clearance,
          `${id}: 最大挙上時の${head.what}との間隔が ${clearance.toFixed(2)}px しかない`,
        ).toBeGreaterThanOrEqual(MIN_HEAD_CLEARANCE);
      }
    },
  );

  it.each(ILLUSTRATIONS.map((i) => [i.id, i] as const))(
    '%s: 傾きは胸郭グループの外側にある',
    (id, illustration) => {
      // geometryOf 内で検査している。ここでは例外なく読み取れることを確かめる
      expect(() => geometryOf(id, illustration.situationKeys[0])).not.toThrow();
    },
  );
});
