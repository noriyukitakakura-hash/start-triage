import type { ReactNode } from 'react';
import type { HairStyle } from './appearance';

/**
 * 傷病者イラスト（SPEC §3.4 / docs/OBSERVATION.md §5）。
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

/**
 * 髪・被り物。**頭部の円の裏に、頭頂側へずらした円を重ねる。**
 *
 * 半径を「頭部の半径 + ずらし量」にすると、**反頭頂側では頭部の縁とちょうど一致する。**
 * つまり胸郭の側へは一切はみ出さないので、頭部のクリアランス（2px以上）を
 * 髪型が侵食することがない。幾何テストもこの円をそのまま検査できる。
 */
const HAIR_OFFSETS: Record<Exclude<HairStyle, 'none'>, number> = {
  short: 3,
  full: 7,
  bun: 4,
  helmet: 5,
};

function Hair({ hair, r, crownDeg }: { hair: HairStyle; r: number; crownDeg: number }) {
  if (hair === 'none') return null;
  const offset = HAIR_OFFSETS[hair];
  // 頭頂の向きへずらす。crownDeg は 0 が画面上
  const rad = ((crownDeg - 90) * Math.PI) / 180;
  const dx = Math.cos(rad) * offset;
  const dy = Math.sin(rad) * offset;
  const className = hair === 'helmet' ? 'hair hair--helmet' : 'hair';

  // まとめ髪は、髪の円のさらに外へ出す。内側に置くと頭部の裏に隠れて見えない
  const bunDistance = offset + r + r * 0.3;

  return (
    <>
      <circle cx={dx} cy={dy} r={r + offset} className={className} />
      {hair === 'bun' && (
        <circle
          cx={Math.cos(rad) * bunDistance}
          cy={Math.sin(rad) * bunDistance}
          r={r * 0.42}
          className="hair"
        />
      )}
      {hair === 'helmet' && (
        /* つば。頭頂の向きに対して横一文字に入れる */
        <line
          x1={Math.cos(rad + Math.PI / 2) * (r + offset)}
          y1={Math.sin(rad + Math.PI / 2) * (r + offset)}
          x2={Math.cos(rad - Math.PI / 2) * (r + offset)}
          y2={Math.sin(rad - Math.PI / 2) * (r + offset)}
          strokeWidth={3}
          className="hair--brim"
        />
      )}
    </>
  );
}

export const FIGURE_VIEWBOX = '0 0 200 200';

export function Head({ cx, cy, r = 15 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} className="body" />;
}

function Limb({ d, w = 11 }: { d: string; w?: number }) {
  return <path d={d} strokeWidth={w} className="limb" />;
}

/**
 * 胸郭。`children` ではなく矩形で描くのは、全ポーズで
 * バウンディングボックスの底辺が確実に横隔膜/背面になるようにするため。
 *
 * **傾きはここで持たない。** `FigureParts.chestRotate` で宣言し、
 * `PatientFigure` が `.chest` の**外側**で回す（下記の規約を参照）。
 */
function Chest({ x, y, w, h, rx }: { x: number; y: number; w: number; h: number; rx: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} className="torso" />;
}

/** 頸部。胸郭が挙上すると肩がこれに近づき、動きが読み取りやすくなる */
function Neck({ x, y, w = 11, h = 14 }: { x: number; y: number; w?: number; h?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={5} className="body" />;
}

export function Ground({ y = 186, x1 = 14, x2 = 186 }: { y?: number; x1?: number; x2?: number }) {
  return <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={4} className="ground" />;
}

/**
 * 各イラストは「胸郭以外のすべて」と「胸郭」を分けて返す。
 * `PatientFigure` が胸郭だけを `<g class="chest">` で包むため。
 */
/** 頭部と髪。髪は頭部の裏に敷くので、ここでまとめて描く */
export function HeadGroup({ head, hair }: { head: FigureParts['head']; hair: HairStyle }) {
  return (
    <g transform={`translate(${head.cx} ${head.cy})`}>
      <Hair hair={hair} r={head.r} crownDeg={head.crownDeg ?? 0} />
      <Head cx={0} cy={0} r={head.r} />
    </g>
  );
}

export interface FigureParts {
  /** 胸郭より奥に描くもの（瓦礫・車体など）。地面は `groundY` が担う */
  behind: ReactNode;
  /** 胸郭（`<Chest>` を1つだけ返す） */
  chest: ReactNode;
  /** 胸郭より手前に描くもの（四肢・頸部）。頭部は `head` が担う */
  front: ReactNode;
  /**
   * 接地線の y。体格の拡縮はここを支点にするので、足（臥位は背面）が地面から離れない。
   * 地面そのものは拡縮の外側で描く。人物が大柄でも地面まで広がっては意味が変わる
   */
  groundY: number;
  /**
   * 頭部。**描画ではなく位置で宣言する。** 髪型を重ねるために位置が要る。
   * `crownDeg` は頭頂の向き（度。0 が画面上、-90 が画面左）で、臥位では横を向く
   */
  head: { cx: number; cy: number; r: number; crownDeg?: number };
  /**
   * 体格の拡縮から外す。情景に挟まれた図に使う。
   * 車室の天井のように、人物だけ拡大すると突き抜けてしまう構図があるため
   */
  fixedScale?: boolean;
  /**
   * 胸郭の傾き。**`.chest` の外側**で適用される。
   *
   * 内側で回すと `.chest` のバウンディングボックスが「回転後の矩形の軸平行外接矩形」になり、
   * `transform-origin: center bottom` が横隔膜ではなく最下の**角**を指してしまう。
   * さらに scaleY が体軸ではなく画面の縦方向に効き、膨らみがせん断する。
   */
  chestRotate?: { deg: number; cx: number; cy: number };
}

// ---------------------------------------------------------------------------
// 歩行可能
// ---------------------------------------------------------------------------

/** 自力歩行 */
const walkingUnaided: FigureParts = {
  behind: null,
  chest: <Chest x={85} y={56} w={30} h={44} rx={13} />,
  front: (
    <>
      <Neck x={94} y={42} />
      <Limb d="M100 100 L86 142 L78 184" />
      <Limb d="M100 100 L116 140 L126 184" />
      {/* 腕は胸郭の外へ逃がす */}
      <Limb d="M83 64 L68 88 L72 110" w={9} />
      <Limb d="M117 64 L132 86 L128 108" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 100, cy: 30, r: 14 },
};

/** 足を引きずって歩行 */
const walkingLimping: FigureParts = {
  behind: null,
  chest: <Chest x={85} y={58} w={30} h={44} rx={13} />,
  chestRotate: { deg: -6, cx: 100, cy: 102 },
  front: (
    <>
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
  groundY: 186,
  head: { cx: 96, cy: 32, r: 14 },
};

/** 腕を押さえながら歩行 */
const walkingHoldingArm: FigureParts = {
  behind: null,
  chest: <Chest x={85} y={56} w={30} h={44} rx={13} />,
  front: (
    <>
      <Neck x={94} y={42} />
      <Limb d="M100 100 L88 142 L82 184" />
      <Limb d="M100 100 L113 142 L120 184" />
      {/* 負傷した腕を腹部の前で抱える。胸郭には重ねない */}
      <Limb d="M83 66 L70 98 L102 110" w={9} />
      {/* それを支える腕 */}
      <Limb d="M117 66 L128 98 L104 106" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 100, cy: 30, r: 14 },
};

/** 立ち上がって手を挙げる */
const standingWaving: FigureParts = {
  behind: null,
  chest: <Chest x={85} y={56} w={30} h={44} rx={13} />,
  front: (
    <>
      <Neck x={94} y={42} />
      <Limb d="M100 100 L93 142 L91 184" />
      <Limb d="M100 100 L109 142 L112 184" />
      {/* 挙げた腕 */}
      <Limb d="M117 62 L136 42 L144 20" w={9} />
      <Limb d="M83 64 L68 92 L74 114" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 100, cy: 30, r: 14 },
};

/** ゆっくりだが自力で歩行 */
const walkingSlowly: FigureParts = {
  behind: null,
  chest: <Chest x={86} y={60} w={30} h={42} rx={13} />,
  chestRotate: { deg: 9, cx: 101, cy: 102 },
  front: (
    <>
      {/* 前かがみ */}
      <Neck x={100} y={47} w={12} h={17} />
      <Limb d="M100 102 L94 142 L92 184" />
      <Limb d="M100 102 L111 142 L118 183" />
      <Limb d="M86 74 L70 102 L76 124" w={9} />
      <Limb d="M122 72 L134 98 L130 120" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 112, cy: 35, r: 14 },
};

/** 頭を押さえて歩行 */
const walkingCoveringHead: FigureParts = {
  behind: null,
  chest: <Chest x={85} y={56} w={30} h={44} rx={13} />,
  front: (
    <>
      <Neck x={94} y={42} />
      <Limb d="M100 100 L86 142 L78 184" />
      <Limb d="M100 100 L116 140 L126 184" />
      <Limb d="M83 64 L68 88 L72 110" w={9} />
      {/* 頭へ伸ばした腕。胸郭の右辺より外を通す */}
      <Limb d="M122 64 L138 42 L118 26" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 100, cy: 30, r: 14 },
};

/** 棒を支えにして歩行 */
const walkingWithStick: FigureParts = {
  behind: (
    <>
      {/* 杖代わりの棒 */}
      <line x1={76} y1={100} x2={68} y2={186} strokeWidth={4} className="prop" />
    </>
  ),
  chest: <Chest x={85} y={58} w={30} h={42} rx={13} />,
  front: (
    <>
      <Neck x={94} y={44} />
      <Limb d="M100 100 L88 142 L80 184" />
      <Limb d="M100 100 L114 140 L122 184" />
      {/* 棒を握る腕 */}
      <Limb d="M83 66 L72 96 L74 120" w={9} />
      <Limb d="M117 66 L130 92 L128 116" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 100, cy: 32, r: 14 },
};

// ---------------------------------------------------------------------------
// 歩行不能
// ---------------------------------------------------------------------------

/** 座り込んで立ち上がれない */
const sittingSlumped: FigureParts = {
  behind: null,
  chest: <Chest x={78} y={94} w={30} h={44} rx={13} />,
  front: (
    <>
      {/* うなだれた頭部 */}
      <Neck x={81} y={80} w={12} h={16} />
      {/* 前方へ投げ出した脚 */}
      <Limb d="M96 138 L142 158 L166 162" />
      <Limb d="M96 146 L138 172 L164 176" />
      {/* 力の入らない腕。胸郭の外側へ */}
      <Limb d="M76 106 L62 136 L70 160" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 84, cy: 69, r: 14 },
};

/** 仰向けに倒れて動かない */
const supineStill: FigureParts = {
  behind: null,
  // 背面が地面に接する。底辺固定で上方へ膨らむ＝胸郭の挙上
  chest: <Chest x={72} y={124} w={54} h={46} rx={17} />,
  front: (
    <>
      <Neck x={60} y={144} w={14} h={12} />
      {/* 投げ出した脚 */}
      <Limb d="M126 148 L166 146 L184 152" />
      <Limb d="M126 160 L164 162 L182 166" />
      {/* 体側に投げ出した腕。胸郭の上端（動く辺）には重ねない */}
      <Limb d="M100 166 L128 176 L150 174" w={9} />
    </>
  ),
  groundY: 172,
  head: { cx: 48, cy: 150, r: 15, crownDeg: -90 },
};

/** うつ伏せに倒れて動かない */
const proneStill: FigureParts = {
  behind: null,
  chest: <Chest x={72} y={128} w={54} h={42} rx={16} />,
  front: (
    <>
      {/* 顔を横に向けた頭部 */}
      <Neck x={60} y={150} w={14} h={12} />
      <Limb d="M126 152 L166 148 L184 154" />
      <Limb d="M126 163 L164 164 L182 168" />
      {/* 頭の横で曲げた腕（うつ伏せの手がかり）。胸郭の左端から出す */}
      <Limb d="M72 136 L54 118 L34 126" w={9} />
    </>
  ),
  groundY: 172,
  head: { cx: 48, cy: 154, r: 15, crownDeg: -90 },
};

/** 瓦礫に下肢を挟まれて動けない */
const legsPinned: FigureParts = {
  behind: (
    <>
      {/* 瓦礫のスラブ */}
      <polygon points="136,122 194,110 198,170 132,172" className="prop-fill" />
      <polyline points="136,122 194,110 198,170 132,172 136,122" strokeWidth={3} className="prop" />
      <line x1={152} y1={120} x2={162} y2={170} strokeWidth={3} className="prop" />
    </>
  ),
  chest: <Chest x={64} y={122} w={52} h={46} rx={17} />,
  front: (
    <>
      <Neck x={52} y={142} w={14} h={12} />
      {/* 瓦礫の下へ消える脚 */}
      <Limb d="M116 148 L150 150" />
      <Limb d="M116 160 L148 164" />
      <Limb d="M90 164 L112 174 L128 172" w={9} />
    </>
  ),
  groundY: 172,
  head: { cx: 40, cy: 148, r: 15, crownDeg: -90 },
};

/** 壁にもたれたまま動けない */
const leaningWall: FigureParts = {
  behind: (
    <>
      {/* 壁 */}
      <rect x={168} y={16} width={20} height={170} className="prop-fill" />
      <line x1={168} y1={16} x2={168} y2={186} strokeWidth={3} className="prop" />
    </>
  ),
  chest: <Chest x={128} y={62} w={30} h={44} rx={13} />,
  chestRotate: { deg: 9, cx: 143, cy: 106 },
  front: (
    <>
      <Neck x={139} y={48} />
      {/* 投げ出した脚 */}
      <Limb d="M143 106 L126 150 L110 182" />
      <Limb d="M143 106 L150 150 L146 184" />
      {/* 垂れた腕。胸郭の外側（左）へ */}
      <Limb d="M126 72 L110 102 L116 126" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 146, cy: 36, r: 14 },
};

/** 車内に閉じ込められて動けない */
const trappedVehicle: FigureParts = {
  behind: (
    <>
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
  chest: <Chest x={74} y={107} w={28} h={35} rx={12} />,
  front: (
    <>
      <Neck x={81} y={93} w={11} h={15} />
      {/* 前方へ伸ばした脚 */}
      <Limb d="M92 142 L124 154 L146 150" w={10} />
      {/* 腕は胸郭の外側（左）へ */}
      <Limb d="M74 112 L58 136 L66 154" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 84, cy: 84, r: 13 },
};

/** 瓦礫に寄りかかって座り込んでいる */
const sittingAgainstDebris: FigureParts = {
  behind: (
    <>
      {/* 背後の瓦礫 */}
      <polygon points="116,186 124,110 156,94 184,132 188,186" className="prop-fill" />
      <polyline points="116,186 124,110 156,94 184,132 188,186" strokeWidth={3} className="prop" />
      <line x1={140} y1={102} x2={150} y2={184} strokeWidth={3} className="prop" />
    </>
  ),
  chest: <Chest x={80} y={96} w={30} h={44} rx={13} />,
  chestRotate: { deg: 10, cx: 95, cy: 140 },
  front: (
    <>
      <Neck x={86} y={80} w={12} h={16} />
      {/* 左方へ投げ出した脚 */}
      <Limb d="M95 142 L54 160 L32 158" />
      <Limb d="M97 150 L58 176 L36 176" />
      {/* 腕は胸郭の外側（左）へ */}
      <Limb d="M80 106 L62 134 L68 160" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 90, cy: 69, r: 14 },
};

/**
 * 立っているが足が動かず歩けない。
 *
 * **画像だけで判断させない訓練として最重要の症例**（SPEC §7 リスク表）。
 * 「立っている＝歩行可能」ではないことを突きつける。
 * 歩行可能な症例との差: 歩幅がなく両足が揃い、腕が力なく垂れている。
 */
const standingUnable: FigureParts = {
  behind: null,
  chest: <Chest x={85} y={56} w={30} h={44} rx={13} />,
  front: (
    <>
      <Neck x={94} y={42} />
      {/* 揃った両足。歩幅がない */}
      <Limb d="M100 100 L96 142 L95 184" />
      <Limb d="M100 100 L105 142 L106 184" />
      {/* 力なく垂れた腕 */}
      <Limb d="M83 66 L74 104 L77 130" w={9} />
      <Limb d="M117 66 L126 104 L123 130" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 100, cy: 30, r: 14 },
};

/**
 * `domain/illustrations.ts` の `id` と 1 対 1 で対応する。
 * 対応の網羅性は tests/patientFigure.spec.tsx が検証する。
 */
/**
 * 座位で上体を起こしている。
 *
 * **歩行可・歩行不能の両方の症例で使う。** 絵が答えを決めないことが狙いであり、
 * 同じ図を共有することで「姿勢に手がかりがある」という誤学習を構造的に防ぐ。
 */
const sittingUpright: FigureParts = {
  behind: null,
  chest: <Chest x={78} y={92} w={30} h={44} rx={13} />,
  front: (
    <>
      <Neck x={81} y={76} w={12} h={16} />
      {/* 前方へ投げ出した脚 */}
      <Limb d="M96 136 L142 156 L166 160" />
      <Limb d="M96 144 L138 170 L164 174" />
      <Limb d="M76 104 L62 134 L70 160" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 84, cy: 66, r: 14 },
};

/** 側臥位 */
const lateralRecumbent: FigureParts = {
  behind: null,
  // 接地している側面が底辺。底辺固定で上方へ膨らむ＝胸郭の挙上
  chest: <Chest x={72} y={122} w={52} h={46} rx={17} />,
  front: (
    <>
      <Neck x={58} y={140} w={14} h={12} />
      {/* 引き寄せた脚 */}
      <Limb d="M124 150 L158 140 L150 166" />
      <Limb d="M124 160 L152 154 L146 174" />
      {/* 腕は胸郭の可動域の外（下側と右側）へ */}
      <Limb d="M100 164 L130 172 L152 168" w={9} />
      <Limb d="M126 130 L150 122 L168 130" w={9} />
    </>
  ),
  groundY: 172,
  head: { cx: 44, cy: 146, r: 15, crownDeg: -90 },
};

/** 四つ這い */
const crawling: FigureParts = {
  behind: null,
  // 腹側が底辺。膨らむと背中が持ち上がる
  chest: <Chest x={74} y={116} w={52} h={34} rx={15} />,
  front: (
    <>
      <Neck x={58} y={118} w={16} h={12} />
      {/* 接地した四肢。付け根は動かない底辺に置く */}
      <Limb d="M80 150 L74 166 L70 180" w={9} />
      <Limb d="M92 150 L88 168 L84 180" w={9} />
      <Limb d="M122 150 L132 166 L138 180" />
      <Limb d="M134 150 L142 166 L148 180" />
    </>
  ),
  groundY: 182,
  head: { cx: 44, cy: 124, r: 14, crownDeg: -90 },
};

/** 膝をついてうずくまる */
const kneelingSlumped: FigureParts = {
  behind: null,
  chest: <Chest x={82} y={94} w={30} h={42} rx={13} />,
  front: (
    <>
      <Neck x={80} y={78} w={12} h={16} />
      {/* 膝立ち。脛は後方へ折る */}
      <Limb d="M97 136 L104 172 L86 182" />
      <Limb d="M107 136 L116 172 L98 184" />
      <Limb d="M80 104 L66 134 L72 160" w={9} />
    </>
  ),
  groundY: 186,
  head: { cx: 82, cy: 66, r: 14 },
};

/** 階段の途中に倒れている */
const lyingOnStairs: FigureParts = {
  behind: (
    <>
      {/* 段。枠外まで引いて、どの縮尺でも隙間が出ないようにする */}
      <polygon points="136,182 136,158 160,158 160,134 184,134 184,110 210,110 210,182" className="prop-fill" />
      <polyline points="136,182 136,158 160,158 160,134 184,134 184,110 210,110" strokeWidth={3} className="prop" />
    </>
  ),
  chest: <Chest x={76} y={118} w={52} h={42} rx={16} />,
  chestRotate: { deg: -10, cx: 102, cy: 160 },
  front: (
    <>
      <Neck x={60} y={136} w={14} h={12} />
      {/* 段に乗った脚 */}
      <Limb d="M128 146 L162 138 L180 146" />
      <Limb d="M128 158 L160 152 L178 160" />
      <Limb d="M104 162 L132 170 L154 166" w={9} />
    </>
  ),
  groundY: 182,
  head: { cx: 46, cy: 140, r: 15, crownDeg: -90 },
};

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
  'walking-covering-head': walkingCoveringHead,
  'walking-with-stick': walkingWithStick,
  'lateral-recumbent': lateralRecumbent,
  'crawling': crawling,
  'kneeling-slumped': kneelingSlumped,
  'lying-on-stairs': lyingOnStairs,
  // 絵だけでは歩行可否を決められない対。**同一のオブジェクトを共有する**
  'sitting-after-walking': sittingUpright,
  'sitting-head-up': sittingUpright,
  'leaning-wall-resting': leaningWall,
};
