import type { ReactNode } from 'react';

/**
 * 傷病者イラスト 13 種（SPEC §3.4 / docs/OBSERVATION.md §5）。
 *
 * 共通の規約:
 * - viewBox は `0 0 200 200`
 * - 胸郭は必ず `<Chest>` で描く。`<PatientFigure>` がこれに
 *   `class="chest"` と `animation-duration` を付与して呼吸させる
 * - **胸郭の底辺が横隔膜（立位）または背面（臥位）になるよう配置する。**
 *   `transform-origin: center bottom` で上方へ膨らむため、立位でも臥位でも
 *   同一の規則で正しい向きに動く
 * - **四肢を胸郭に重ねない。** 動くのは胸郭だけなので、腕が被ると呼吸の動きが隠れて
 *   数えられなくなる。見た目の問題ではなく実測モードの機能要件である
 * - **胸郭は最大振幅（1.18）で膨らんでも頭部に食い込まない間隔を空ける。**
 *   立位は胸郭の高さ44px・振幅1.18で上端が8px持ち上がるため、頭部との間に10px以上取る
 * - 実写は使わない。ピクトグラム風の抽象表現にとどめる（SPEC §1.7）
 */

export const FIGURE_VIEWBOX = '0 0 200 200';

function Head({ cx, cy, r = 15 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} className="body" />;
}

function Limb({ d, w = 11 }: { d: string; w?: number }) {
  return <path d={d} strokeWidth={w} className="limb" />;
}

/**
 * 胸郭。`children` ではなく矩形で描くのは、全ポーズで
 * バウンディングボックスの底辺が確実に横隔膜/背面になるようにするため。
 */
function Chest({
  x,
  y,
  w,
  h,
  rx,
  rotate,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  rotate?: { deg: number; cx: number; cy: number };
}) {
  const rect = <rect x={x} y={y} width={w} height={h} rx={rx} className="torso" />;
  if (rotate === undefined) return rect;
  // 回転は chest グループの外側で行う。内側で回すと scaleY の向きがずれる
  return <g transform={`rotate(${rotate.deg} ${rotate.cx} ${rotate.cy})`}>{rect}</g>;
}

/** 頸部。胸郭が挙上すると肩がこれに近づき、動きが読み取りやすくなる */
function Neck({ x, y, w = 11, h = 14 }: { x: number; y: number; w?: number; h?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={5} className="body" />;
}

function Ground({ y = 186, x1 = 14, x2 = 186 }: { y?: number; x1?: number; x2?: number }) {
  return <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={4} className="ground" />;
}

/**
 * 各イラストは「胸郭以外のすべて」と「胸郭」を分けて返す。
 * `PatientFigure` が胸郭だけを `<g class="chest">` で包むため。
 */
export interface FigureParts {
  /** 胸郭より奥に描くもの（地面・瓦礫・車体など） */
  behind: ReactNode;
  /** 胸郭（`<Chest>` を1つだけ返す） */
  chest: ReactNode;
  /** 胸郭より手前に描くもの（頭部・四肢） */
  front: ReactNode;
}

// ---------------------------------------------------------------------------
// 歩行可能
// ---------------------------------------------------------------------------

/** 自力歩行 */
const walkingUnaided: FigureParts = {
  behind: <Ground />,
  chest: <Chest x={85} y={56} w={30} h={44} rx={13} />,
  front: (
    <>
      <Head cx={100} cy={30} r={14} />
      <Neck x={94} y={42} />
      <Limb d="M100 100 L86 142 L78 184" />
      <Limb d="M100 100 L116 140 L126 184" />
      {/* 腕は胸郭の外へ逃がす */}
      <Limb d="M83 64 L68 88 L72 110" w={9} />
      <Limb d="M117 64 L132 86 L128 108" w={9} />
    </>
  ),
};

/** 足を引きずって歩行 */
const walkingLimping: FigureParts = {
  behind: <Ground />,
  chest: <Chest x={85} y={58} w={30} h={44} rx={13} rotate={{ deg: -6, cx: 100, cy: 102 }} />,
  front: (
    <>
      <Head cx={96} cy={32} r={14} />
      <Neck x={91} y={44} />
      {/* 支えている脚 */}
      <Limb d="M98 102 L90 144 L86 184" />
      {/* 引きずっている脚 */}
      <Limb d="M98 102 L122 138 L140 176" />
      <Limb d="M81 66 L66 92 L72 114" w={9} />
      {/* 腿を押さえる腕。胸郭より下で内側へ入る */}
      <Limb d="M117 66 L128 100 L112 124" w={9} />
    </>
  ),
};

/** 腕を押さえながら歩行 */
const walkingHoldingArm: FigureParts = {
  behind: <Ground />,
  chest: <Chest x={85} y={56} w={30} h={44} rx={13} />,
  front: (
    <>
      <Head cx={100} cy={30} r={14} />
      <Neck x={94} y={42} />
      <Limb d="M100 100 L88 142 L82 184" />
      <Limb d="M100 100 L113 142 L120 184" />
      {/* 負傷した腕を腹部の前で抱える。胸郭には重ねない */}
      <Limb d="M83 66 L70 98 L102 110" w={9} />
      {/* それを支える腕 */}
      <Limb d="M117 66 L128 98 L104 106" w={9} />
    </>
  ),
};

/** 立ち上がって手を挙げる */
const standingWaving: FigureParts = {
  behind: <Ground />,
  chest: <Chest x={85} y={56} w={30} h={44} rx={13} />,
  front: (
    <>
      <Head cx={100} cy={30} r={14} />
      <Neck x={94} y={42} />
      <Limb d="M100 100 L93 142 L91 184" />
      <Limb d="M100 100 L109 142 L112 184" />
      {/* 挙げた腕 */}
      <Limb d="M117 62 L136 42 L144 20" w={9} />
      <Limb d="M83 64 L68 92 L74 114" w={9} />
    </>
  ),
};

/** ゆっくりだが自力で歩行 */
const walkingSlowly: FigureParts = {
  behind: <Ground />,
  chest: <Chest x={86} y={60} w={30} h={42} rx={13} rotate={{ deg: 9, cx: 101, cy: 102 }} />,
  front: (
    <>
      {/* 前かがみ */}
      <Head cx={112} cy={38} r={14} />
      <Neck x={100} y={50} w={12} h={14} />
      <Limb d="M100 102 L94 142 L92 184" />
      <Limb d="M100 102 L111 142 L118 183" />
      <Limb d="M86 74 L70 102 L76 124" w={9} />
      <Limb d="M120 72 L134 98 L130 120" w={9} />
    </>
  ),
};

// ---------------------------------------------------------------------------
// 歩行不能
// ---------------------------------------------------------------------------

/** 座り込んで立ち上がれない */
const sittingSlumped: FigureParts = {
  behind: <Ground />,
  chest: <Chest x={78} y={94} w={30} h={44} rx={13} />,
  front: (
    <>
      {/* うなだれた頭部 */}
      <Head cx={84} cy={72} r={14} />
      <Neck x={81} y={82} w={12} h={14} />
      {/* 前方へ投げ出した脚 */}
      <Limb d="M96 138 L142 158 L166 162" />
      <Limb d="M96 146 L138 172 L164 176" />
      {/* 力の入らない腕。胸郭の外側へ */}
      <Limb d="M76 106 L62 136 L70 160" w={9} />
    </>
  ),
};

/** 仰向けに倒れて動かない */
const supineStill: FigureParts = {
  behind: <Ground y={172} />,
  // 背面が地面に接する。底辺固定で上方へ膨らむ＝胸郭の挙上
  chest: <Chest x={72} y={124} w={54} h={46} rx={17} />,
  front: (
    <>
      <Head cx={48} cy={150} r={15} />
      <Neck x={60} y={144} w={14} h={12} />
      {/* 投げ出した脚 */}
      <Limb d="M126 148 L166 146 L184 152" />
      <Limb d="M126 160 L164 162 L182 166" />
      {/* 体側に投げ出した腕。胸郭の上端（動く辺）には重ねない */}
      <Limb d="M100 166 L128 176 L150 174" w={9} />
    </>
  ),
};

/** うつ伏せに倒れて動かない */
const proneStill: FigureParts = {
  behind: <Ground y={172} />,
  chest: <Chest x={72} y={128} w={54} h={42} rx={16} />,
  front: (
    <>
      {/* 顔を横に向けた頭部 */}
      <Head cx={48} cy={154} r={15} />
      <Neck x={60} y={150} w={14} h={12} />
      <Limb d="M126 152 L166 148 L184 154" />
      <Limb d="M126 163 L164 164 L182 168" />
      {/* 頭の横で曲げた腕（うつ伏せの手がかり）。胸郭の左端から出す */}
      <Limb d="M72 136 L54 118 L34 126" w={9} />
    </>
  ),
};

/** 瓦礫に下肢を挟まれて動けない */
const legsPinned: FigureParts = {
  behind: (
    <>
      <Ground y={172} />
      {/* 瓦礫のスラブ */}
      <polygon points="136,122 194,110 198,170 132,172" className="prop-fill" />
      <polyline points="136,122 194,110 198,170 132,172 136,122" strokeWidth={3} className="prop" />
      <line x1={152} y1={120} x2={162} y2={170} strokeWidth={3} className="prop" />
    </>
  ),
  chest: <Chest x={64} y={122} w={52} h={46} rx={17} />,
  front: (
    <>
      <Head cx={40} cy={148} r={15} />
      <Neck x={52} y={142} w={14} h={12} />
      {/* 瓦礫の下へ消える脚 */}
      <Limb d="M116 148 L150 150" />
      <Limb d="M116 160 L148 164" />
      <Limb d="M90 164 L112 174 L128 172" w={9} />
    </>
  ),
};

/** 壁にもたれたまま動けない */
const leaningWall: FigureParts = {
  behind: (
    <>
      <Ground />
      {/* 壁 */}
      <rect x={168} y={16} width={20} height={170} className="prop-fill" />
      <line x1={168} y1={16} x2={168} y2={186} strokeWidth={3} className="prop" />
    </>
  ),
  chest: <Chest x={128} y={62} w={30} h={44} rx={13} rotate={{ deg: 9, cx: 143, cy: 106 }} />,
  front: (
    <>
      <Head cx={146} cy={36} r={14} />
      <Neck x={139} y={48} />
      {/* 投げ出した脚 */}
      <Limb d="M143 106 L126 150 L110 182" />
      <Limb d="M143 106 L150 150 L146 184" />
      {/* 垂れた腕。胸郭の外側（左）へ */}
      <Limb d="M126 72 L110 102 L116 126" w={9} />
    </>
  ),
};

/** 車内に閉じ込められて動けない */
const trappedVehicle: FigureParts = {
  behind: (
    <>
      <Ground />
      {/* 車室の輪郭 */}
      <path
        d="M28 166 L34 108 Q38 84 64 82 L134 82 Q158 84 168 110 L178 166"
        strokeWidth={4}
        className="prop"
      />
      <line x1={28} y1={166} x2={178} y2={166} strokeWidth={4} className="prop" />
      <line x1={124} y1={82} x2={124} y2={166} strokeWidth={3} className="prop" />
      <circle cx={54} cy={172} r={13} className="prop-fill" />
      <circle cx={152} cy={172} r={13} className="prop-fill" />
    </>
  ),
  chest: <Chest x={74} y={104} w={28} h={38} rx={12} />,
  front: (
    <>
      <Head cx={84} cy={84} r={13} />
      <Neck x={81} y={93} w={11} h={12} />
      {/* 前方へ伸ばした脚 */}
      <Limb d="M92 142 L124 154 L146 150" w={10} />
      {/* 腕は胸郭の外側（左）へ */}
      <Limb d="M74 112 L58 136 L66 154" w={9} />
    </>
  ),
};

/** 瓦礫に寄りかかって座り込んでいる */
const sittingAgainstDebris: FigureParts = {
  behind: (
    <>
      <Ground />
      {/* 背後の瓦礫 */}
      <polygon points="116,186 124,110 156,94 184,132 188,186" className="prop-fill" />
      <polyline points="116,186 124,110 156,94 184,132 188,186" strokeWidth={3} className="prop" />
      <line x1={140} y1={102} x2={150} y2={184} strokeWidth={3} className="prop" />
    </>
  ),
  chest: <Chest x={80} y={96} w={30} h={44} rx={13} rotate={{ deg: 10, cx: 95, cy: 140 }} />,
  front: (
    <>
      <Head cx={90} cy={72} r={14} />
      <Neck x={86} y={82} w={12} h={14} />
      {/* 左方へ投げ出した脚 */}
      <Limb d="M95 142 L54 160 L32 158" />
      <Limb d="M97 150 L58 176 L36 176" />
      {/* 腕は胸郭の外側（左）へ */}
      <Limb d="M80 106 L62 134 L68 160" w={9} />
    </>
  ),
};

/**
 * 立っているが足が動かず歩けない。
 *
 * **画像だけで判断させない訓練として最重要の症例**（SPEC §7 リスク表）。
 * 「立っている＝歩行可能」ではないことを突きつける。
 * 歩行可能な症例との差: 歩幅がなく両足が揃い、腕が力なく垂れている。
 */
const standingUnable: FigureParts = {
  behind: <Ground />,
  chest: <Chest x={85} y={56} w={30} h={44} rx={13} />,
  front: (
    <>
      <Head cx={100} cy={30} r={14} />
      <Neck x={94} y={42} />
      {/* 揃った両足。歩幅がない */}
      <Limb d="M100 100 L96 142 L95 184" />
      <Limb d="M100 100 L105 142 L106 184" />
      {/* 力なく垂れた腕 */}
      <Limb d="M83 66 L74 104 L77 130" w={9} />
      <Limb d="M117 66 L126 104 L123 130" w={9} />
    </>
  ),
};

/**
 * `domain/illustrations.ts` の `id` と 1 対 1 で対応する。
 * 対応の網羅性は tests/patientFigure.spec.tsx が検証する。
 */
export const FIGURES: Readonly<Record<string, FigureParts>> = {
  'walking-unaided': walkingUnaided,
  'walking-limping': walkingLimping,
  'walking-holding-arm': walkingHoldingArm,
  'standing-waving': standingWaving,
  'walking-slowly': walkingSlowly,
  'sitting-slumped': sittingSlumped,
  'supine-still': supineStill,
  'prone-still': proneStill,
  'legs-pinned': legsPinned,
  'leaning-wall': leaningWall,
  'trapped-vehicle': trappedVehicle,
  'sitting-against-debris': sittingAgainstDebris,
  'standing-unable': standingUnable,
};
