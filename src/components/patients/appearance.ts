/**
 * 傷病者の見た目の個体差（SPEC §3.4）。
 *
 * **ドメインには置かない。** `TriageCase` は判定に関わる事実だけを持つ設計であり、
 * 見た目は判定に一切関わってはならない。ドメインの外に置くことが、
 * その制約を構造で保証する。
 *
 * **症例IDから決める。** 同じ症例は何度描き直しても同じ姿で現れる。
 * 乱数を描画時に引くと、計測の途中で別人に変わってしまう。
 */

/**
 * 髪型。判定とは無関係であり、歩行可否と相関させてはならない。
 *
 * **髪と一目で分かる形だけを置く。** トリアージの訓練で頭部に意味の読めない印が
 * あると、包帯や頭部外傷といった所見として読まれかねない。
 * 判定に関わらないものが所見に見えるのは、見た目が単調であることより悪い。
 */
export const HAIR_STYLES = ['short', 'long', 'none'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

/**
 * 体格。人物の拡縮率。
 *
 * 上限は 1.06。立位の頭頂は接地点から 170px 上にあり、これを超えて拡大すると
 * viewBox（200）からはみ出して頭が切れる。
 */
export const BUILD_SCALES = [0.9, 1, 1.06] as const;
export type BuildScale = (typeof BUILD_SCALES)[number];

export interface Appearance {
  hair: HairStyle;
  buildScale: BuildScale;
}

/**
 * 文字列から安定した整数を作る（FNV-1a）。
 * 暗号用途ではない。同じ入力に同じ値を返すことだけが要件である。
 */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 症例IDから見た目を決める。
 *
 * 髪型と体格で別のビットを使う。同じ値から両方を導くと、
 * 「大柄な人は必ず同じ髪型」といった相関が生まれてしまう。
 */
export function appearanceFor(caseId: string): Appearance {
  const h = hash(caseId);
  const hair = HAIR_STYLES[h % HAIR_STYLES.length] ?? 'short';
  const buildScale = BUILD_SCALES[Math.floor(h / HAIR_STYLES.length) % BUILD_SCALES.length] ?? 1;
  return { hair, buildScale };
}
