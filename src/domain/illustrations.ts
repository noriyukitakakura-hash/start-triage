/**
 * 傷病者イラストのカタログ（SPEC §3.4）。
 *
 * ここはドメインデータであり、SVG そのものは `components/patients/` にある。
 * `id` が SVG コンポーネントの識別子に対応する。
 *
 * **状況文は必須である。** イラストだけでは歩行可否を断定できないため
 * （「立っている」≠「歩行可能」）、必ず状況文を併せて提示して曖昧性を排除する
 * （SPEC §2.2, §7 リスク表）。
 *
 * **状況文は複数持つ。** 同じ絵でも毎回違う一文が付くことで、
 * 「絵を覚えて答える」のではなく「状況文を読む」習慣が保たれる。
 * 症例の生成時に1つを抽選し、以後その症例では固定する。
 */

/**
 * 姿勢の分類。
 *
 * **同じ姿勢が歩行可・歩行不能の両方に存在することを許す。**
 * それは「絵だけでは歩行可否を決められない」ことを意味し、
 * 状況文を読ませるための仕掛けそのものである（SPEC §7 最上段のリスク）。
 */
export const POSES = [
  'walking',
  'standing',
  'sitting-ground',
  'leaning-wall',
  'supine',
  'prone',
  'pinned',
  'vehicle',
  'against-debris',
] as const;
export type Pose = (typeof POSES)[number];

export interface Illustration {
  id: string;
  pose: Pose;
  /** 状況文の翻訳キー候補。1件以上。生成時に1つ抽選して症例に固定する */
  situationKeys: readonly [string, ...string[]];
  canWalk: boolean;
}

export const ILLUSTRATIONS: readonly Illustration[] = [
  // --- 歩行可能 ---
  {
    id: 'walking-unaided',
    pose: 'walking',
    situationKeys: ['situation.walkedOnOwn', 'situation.walkedToAssemblyPoint', 'situation.walkedOutOfBuilding'],
    canWalk: true,
  },
  {
    id: 'walking-limping',
    pose: 'walking',
    situationKeys: ['situation.limpedOver', 'situation.limpedWincing'],
    canWalk: true,
  },
  {
    id: 'walking-holding-arm',
    pose: 'walking',
    situationKeys: ['situation.walkedHoldingArm', 'situation.walkedHoldingShoulder'],
    canWalk: true,
  },
  {
    id: 'standing-waving',
    pose: 'standing',
    // 「立ち上がった」だけでは歩行可否を決められない。歩いたことまで述べる
    situationKeys: ['situation.stoodAndWalkedOver', 'situation.stoodAndEvacuatedOnOwn'],
    canWalk: true,
  },
  {
    id: 'walking-slowly',
    pose: 'walking',
    situationKeys: ['situation.walkedSlowlyOnOwn', 'situation.walkedSlowlyShortOfBreath'],
    canWalk: true,
  },

  // --- 歩行不能 ---
  {
    id: 'sitting-slumped',
    pose: 'sitting-ground',
    situationKeys: ['situation.sittingUnableToStand', 'situation.triedToStandAndFailed'],
    canWalk: false,
  },
  {
    id: 'supine-still',
    pose: 'supine',
    situationKeys: ['situation.lyingStill', 'situation.lyingStillNoResponseToCall'],
    canWalk: false,
  },
  {
    id: 'prone-still',
    pose: 'prone',
    situationKeys: ['situation.lyingFaceDown', 'situation.faceDownCannotMove'],
    canWalk: false,
  },
  {
    id: 'legs-pinned',
    pose: 'pinned',
    situationKeys: ['situation.legsPinnedByDebris', 'situation.legsPinnedCallingForHelp'],
    canWalk: false,
  },
  {
    id: 'leaning-wall',
    pose: 'leaning-wall',
    situationKeys: ['situation.leaningUnableToMove', 'situation.leaningCannotStepForward'],
    canWalk: false,
  },
  {
    id: 'trapped-vehicle',
    pose: 'vehicle',
    situationKeys: ['situation.trappedInVehicle', 'situation.trappedCannotGetOut'],
    canWalk: false,
  },
  {
    id: 'sitting-against-debris',
    pose: 'against-debris',
    situationKeys: ['situation.sittingAgainstDebris', 'situation.proppedOnDebrisCannotStand'],
    canWalk: false,
  },
  // 「立位だが歩行不能」。画像だけで判断させない訓練として重要（SPEC §7）
  {
    id: 'standing-unable',
    pose: 'standing',
    situationKeys: ['situation.standingButCannotWalk', 'situation.standingHoldingOnCannotWalk'],
    canWalk: false,
  },
];

export const WALKABLE_ILLUSTRATIONS = ILLUSTRATIONS.filter((i) => i.canWalk);
export const NON_WALKABLE_ILLUSTRATIONS = ILLUSTRATIONS.filter((i) => !i.canWalk);

/** 全カタログ項目の状況文キー */
export const ALL_SITUATION_KEYS: readonly string[] = ILLUSTRATIONS.flatMap((i) => i.situationKeys);

/**
 * 絵だけでは歩行可否を決められないイラスト。
 * 同じ姿勢が歩行可・歩行不能の両方に存在するものを指す。
 */
export const AMBIGUOUS_ILLUSTRATIONS = ILLUSTRATIONS.filter((i) =>
  ILLUSTRATIONS.some((other) => other.pose === i.pose && other.canWalk !== i.canWalk),
);

/** `id` からカタログ項目を引く。未登録なら undefined */
export function illustrationById(id: string): Illustration | undefined {
  return ILLUSTRATIONS.find((i) => i.id === id);
}
