/**
 * トリアージのドメイン型。
 *
 * この層は **React・i18n・表示文字列に一切依存しない**（docs/I18N.md §5）。
 * 規約は eslint の no-restricted-imports と tests/i18n.spec.ts で機械的に強制している。
 */

/** トリアージ区分。SPEC §3.1 */
export const CATEGORIES = ['I', 'II', 'III', '0'] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * 判定が確定したステップ。SPEC §3.2 のフローに対応する。
 * 学習モードはこれを使ってフローチャートの該当箇所をハイライトする。
 *
 * 「自発呼吸の有無」は単独では判定を確定させない（呼吸がなければ必ず気道確保の
 * 結果で確定する）ため、独立したステップとして持たない。I類と0類の区別は
 * `Judgement.category` が担う。
 */
export const DECIDING_STEPS = [
  /** 歩行可能 → III類 */
  'walk',
  /** 自発呼吸なし → 気道確保の結果で I類 または 0類 */
  'airway',
  /** 呼吸数が基準外 → I類 */
  'respiratoryRate',
  /** CRT遅延 または 橈骨動脈触知不能 → I類 */
  'circulation',
  /** 指示に従えない → I類 / 従える → II類 */
  'consciousness',
] as const;
export type DecidingStep = (typeof DECIDING_STEPS)[number];

/** 1症例。表示文字列は持たず、イラストと状況文はキーで保持する */
export interface TriageCase {
  id: string;
  patient: {
    illustrationId: string;
    /** 状況文の翻訳キー。例 'situation.walkedOnOwn' */
    situationKey: string;
  };
  /** 歩行可否。傷病者イラストと状況文で提示される */
  canWalk: boolean;
  hasSpontaneousBreathing: boolean;
  /**
   * 気道確保後に自発呼吸が再開したか。
   * `hasSpontaneousBreathing === false` の症例のみ意味を持ち、それ以外は null。
   */
  breathingAfterAirway: boolean | null;
  /** 回/分。自発呼吸がない場合は 0 */
  respiratoryRate: number | null;
  radialPulsePalpable: boolean;
  /** 回/分。触知不能なら数えられないため null（SPEC §3.3 整合性制約） */
  pulseRate: number | null;
  /** 毛細血管再充満時間（秒） */
  crtSeconds: number;
  obeysCommands: boolean;
  /**
   * 従命できない症例の反応。`obeysCommands === true` のときは null。
   *
   * `hasSpontaneousBreathing === false` のときだけ意味を持つ
   * `breathingAfterAirway` と同じ扱い。
   *
   * **判定には使わない。** 従命の可否は `obeysCommands` が真値であり、
   * これは声かけへの反応を描き分けるための情報。
   */
  nonObeyingResponse: NonObeyingResponse | null;
}

/**
 * 従命できない症例の反応（SPEC §2.2）。
 *
 * **「反応がある」と「指示に従える」は違う。** うめき声も払いのけも反応だが
 * 従命ではなく、START法ではいずれも I類 になる。取り違えやすい箇所なので、
 * 反応の中身を描き分けて体験させる。
 *
 * - `voiceOnly`    声は出すが指示に従わない（うめき声など）
 * - `movementOnly` 体は動かすが指示に従わない（払いのけるなど）
 * - `none`         反応がない
 */
export const NON_OBEYING_RESPONSES = ['voiceOnly', 'movementOnly', 'none'] as const;
export type NonObeyingResponse = (typeof NON_OBEYING_RESPONSES)[number];

/** 判定根拠。表示層が t(key, params) で文章化する（docs/I18N.md §5） */
export interface RationaleItem {
  key: string;
  params?: Record<string, string | number>;
}

export interface Judgement {
  category: Category;
  decidingStep: DecidingStep;
  rationale: RationaleItem[];
}

/**
 * 判定基準プロファイル。SPEC §3.2。
 *
 * **表示言語とは完全に独立した概念である。** 言語切替でこれを変更してはならない
 * （docs/I18N.md §2）。国・組織により基準値が異なるため外部化している。
 */
export interface RuleProfile {
  id: string;
  /** この値以下の呼吸数を I類とする */
  respiratoryRateLowMax: number;
  /** この値以上の呼吸数を I類とする */
  respiratoryRateHighMin: number;
  /** この秒数以上のCRTを I類とする */
  crtThresholdSeconds: number;
  /** 循環評価で橈骨動脈の触知可否を用いるか */
  useRadialPulse: boolean;
}
