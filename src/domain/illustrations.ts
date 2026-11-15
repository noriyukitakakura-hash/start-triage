/**
 * 傷病者イラストのカタログ（SPEC §3.4）。
 *
 * ここはドメインデータであり、SVG そのものは P2 で `components/patients/` に実装する。
 * `id` が SVG コンポーネントの識別子に対応する。
 *
 * **状況文は必須である。** イラストだけでは歩行可否を断定できないため
 * （「立っている」≠「歩行可能」）、必ず状況文を併せて提示して曖昧性を排除する
 * （SPEC §2.2, §7 リスク表）。
 */
export interface Illustration {
  id: string;
  /** 状況文の翻訳キー */
  situationKey: string;
  canWalk: boolean;
}

export const ILLUSTRATIONS: readonly Illustration[] = [
  // --- 歩行可能 ---
  { id: 'walking-unaided', situationKey: 'situation.walkedOnOwn', canWalk: true },
  { id: 'walking-limping', situationKey: 'situation.limpedOver', canWalk: true },
  { id: 'walking-holding-arm', situationKey: 'situation.walkedHoldingArm', canWalk: true },
  { id: 'standing-waving', situationKey: 'situation.stoodAndWaved', canWalk: true },
  { id: 'walking-slowly', situationKey: 'situation.walkedSlowlyOnOwn', canWalk: true },

  // --- 歩行不能 ---
  { id: 'sitting-slumped', situationKey: 'situation.sittingUnableToStand', canWalk: false },
  { id: 'supine-still', situationKey: 'situation.lyingStill', canWalk: false },
  { id: 'prone-still', situationKey: 'situation.lyingFaceDown', canWalk: false },
  { id: 'legs-pinned', situationKey: 'situation.legsPinnedByDebris', canWalk: false },
  { id: 'leaning-wall', situationKey: 'situation.leaningUnableToMove', canWalk: false },
  { id: 'trapped-vehicle', situationKey: 'situation.trappedInVehicle', canWalk: false },
  { id: 'sitting-against-debris', situationKey: 'situation.sittingAgainstDebris', canWalk: false },
  // 「立位だが歩行不能」。画像だけで判断させない訓練として重要（SPEC §7）
  { id: 'standing-unable', situationKey: 'situation.standingButCannotWalk', canWalk: false },
];

export const WALKABLE_ILLUSTRATIONS = ILLUSTRATIONS.filter((i) => i.canWalk);
export const NON_WALKABLE_ILLUSTRATIONS = ILLUSTRATIONS.filter((i) => !i.canWalk);
