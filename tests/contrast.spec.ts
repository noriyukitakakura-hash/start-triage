import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * コントラスト比の検証（SPEC §5.3）。
 *
 * axe-core は jsdom でレイアウトを持たないためこの規則を評価できない。
 * 実際に使っている色の組み合わせを取り出し、WCAG の式で計算して確かめる。
 *
 * 訓練は屋外や夜間の会場でも行われる。画面が見づらい状況を前提に、
 * 本文は AA（4.5:1）、大きな文字は AA Large（3:1）を下限とする。
 */
const DIST = join(process.cwd(), 'dist');

function ensureBuild(): void {
  if (existsSync(join(DIST, 'index.html'))) return;
  execFileSync('npm', ['run', 'build'], { stdio: 'ignore' });
}

ensureBuild();

const css = readdirSync(join(DIST, 'assets'))
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(DIST, 'assets', f), 'utf8'))
  .join('\n');

/** 生成CSSから Tailwind のテーマ色を読む。手で写すと実際の値とずれる */
function themeColor(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*([^;]+)`).exec(css);
  expect(match, `--color-${name} が生成CSSに無い`).not.toBeNull();
  return (match as RegExpExecArray)[1]!.trim();
}

/**
 * 色の計算。
 *
 * **sRGB の表現を混ぜないこと。** oklch からの変換は線形 RGB を返すため、
 * そのまま 16 進表記（ガンマ補正済み）と並べると結果が狂う。
 * ここでは「ガンマ補正済み sRGB 0..1」に統一して受け渡す。
 */

/** 線形 sRGB → ガンマ補正済み sRGB */
function encodeGamma(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** ガンマ補正済み sRGB → 線形 sRGB */
function decodeGamma(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function oklchToSrgb(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  // ここで得られるのは線形 RGB。必ずガンマを掛けて返す
  return [
    encodeGamma(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    encodeGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    encodeGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** oklch(...) と #rrggbb の双方を「ガンマ補正済み sRGB 0..1」にする */
function toRgb(color: string): [number, number, number] {
  // Tailwind は #fff のような3桁表記も出す
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (hex !== null) {
    const digits = hex[1]!;
    const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
    const v = parseInt(full, 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }

  const ok = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/.exec(color);
  expect(ok, `解釈できない色: ${color}`).not.toBeNull();
  const [, lRaw, cRaw, hRaw] = ok as RegExpExecArray;
  const L = lRaw!.endsWith('%') ? Number(lRaw!.slice(0, -1)) / 100 : Number(lRaw);
  return oklchToSrgb(L, Number(cRaw), (Number(hRaw) * Math.PI) / 180);
}

/** WCAG 2.x の相対輝度 */
function luminance(color: string): number {
  const [r, g, b] = toRgb(color).map(decodeGamma) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

/** 画面で実際に使っている前景色と背景色の組み合わせ */
const PAIRS: { name: string; fg: string; bg: string; min: number }[] = [
  // 本文（AA 4.5:1）
  { name: '本文 slate-100 / 画面 slate-900', fg: 'slate-100', bg: 'slate-900', min: 4.5 },
  { name: '本文 slate-100 / パネル slate-800', fg: 'slate-100', bg: 'slate-800', min: 4.5 },
  { name: '補助 slate-400 / 画面 slate-900', fg: 'slate-400', bg: 'slate-900', min: 4.5 },
  { name: '補助 slate-400 / パネル slate-800', fg: 'slate-400', bg: 'slate-800', min: 4.5 },
  { name: 'シート本文 slate-100 / slate-800', fg: 'slate-100', bg: 'slate-800', min: 4.5 },
  { name: '計測ボタン white / sky-700', fg: 'white', bg: 'sky-700', min: 4.5 },
  { name: '主ボタン slate-900 / slate-100', fg: 'slate-900', bg: 'slate-100', min: 4.5 },
  { name: '警告 amber-300 / パネル slate-800', fg: 'amber-300', bg: 'slate-800', min: 4.5 },
  { name: '正答 green-300 / パネル slate-800', fg: 'green-300', bg: 'slate-800', min: 4.5 },
  // 区分ボタンは大きな文字（AA Large 3:1）
  { name: 'I類 white / red-600', fg: 'white', bg: 'red-600', min: 3 },
  { name: 'II類 slate-900 / amber-400', fg: 'slate-900', bg: 'amber-400', min: 3 },
  { name: 'III類 white / green-600', fg: 'white', bg: 'green-600', min: 3 },
  { name: '0類 white / slate-950', fg: 'white', bg: 'slate-950', min: 3 },
  // ホームの説明文
  { name: 'ホーム説明 sky-100 / sky-700', fg: 'sky-100', bg: 'sky-700', min: 4.5 },
  // フローチャート
  { name: 'フロー確定 slate-950 / sky-500', fg: 'slate-950', bg: 'sky-500', min: 4.5 },
  { name: 'フロー通過 slate-300 / slate-800', fg: 'slate-300', bg: 'slate-800', min: 4.5 },
  { name: 'フロー不要 slate-400 / slate-900', fg: 'slate-400', bg: 'slate-900', min: 4.5 },
  { name: 'フロー不要（縦） slate-400 / slate-800', fg: 'slate-400', bg: 'slate-800', min: 4.5 },
  // 明るい下地の文字
  { name: '選択中の説明 slate-700 / slate-100', fg: 'slate-700', bg: 'slate-100', min: 4.5 },
  { name: '気道確保の結果 slate-100 / slate-700', fg: 'slate-100', bg: 'slate-700', min: 4.5 },
  { name: '動き抑制の通知 slate-200 / slate-700', fg: 'slate-200', bg: 'slate-700', min: 4.5 },
  // 結果画面
  { name: '正解の帯 white / green-700', fg: 'white', bg: 'green-700', min: 4.5 },
  { name: '不正解の帯 white / red-700', fg: 'white', bg: 'red-700', min: 4.5 },
];

describe('コントラスト比（SPEC §5.3）', () => {
  it.each(PAIRS)('$name が $min:1 以上', ({ fg, bg, min }) => {
    const ratio = contrast(themeColor(fg), themeColor(bg));
    expect(ratio, `実測 ${ratio}:1`).toBeGreaterThanOrEqual(min);
  });

  it('計算式が既知の値と一致する（検証器そのものの妥当性）', () => {
    // 白と黒は 21:1、同色は 1:1
    expect(contrast('#ffffff', '#000000')).toBe(21);
    expect(contrast('#777777', '#777777')).toBe(1);
    // 3桁表記も同じ色として扱えること（Tailwind が #fff を出すため）
    expect(contrast('#fff', '#000000')).toBe(21);
    expect(contrast('#fff', '#ffffff')).toBe(1);
    // よく知られた境界: #767676 と白は 4.54:1
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.6);
  });

  it('フォーカスリングが下地から十分に際立つ', () => {
    // リングは slate-50。最も明るい下地（amber-400 の II類ボタン）でも見分けられること
    expect(contrast(themeColor('slate-50'), themeColor('amber-400'))).toBeGreaterThanOrEqual(1.5);
    // 暗い下地では縁取り（slate-900）との差で輪郭が立つ
    expect(contrast(themeColor('slate-50'), themeColor('slate-900'))).toBeGreaterThanOrEqual(3);
  });
});
