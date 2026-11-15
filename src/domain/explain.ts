import { judge } from './judge';
import { DECIDING_STEPS } from './types';
import type { Category, DecidingStep, Judgement, RationaleItem, RuleProfile, TriageCase } from './types';

/**
 * 学習モードの解説を組み立てる（SPEC §2.3）。
 *
 * **翻訳済みの文章は返さない。** 翻訳キーとパラメータの組を返し、文章化は表示層が担う
 * （docs/I18N.md §5）。
 *
 * 各ステップの `status` により、フローチャート上で
 * 「通過したステップ」「判定が確定したステップ」「評価が不要だったステップ」を描き分けられる。
 */

export type StepStatus =
  /** 評価して通過した */
  | 'passed'
  /** ここで判定が確定した */
  | 'decided'
  /** 手前で確定したため評価不要だった */
  | 'skipped';

export interface ExplanationStep {
  step: DecidingStep;
  status: StepStatus;
  /**
   * そのステップで得られた観察。`skipped` のステップは空配列。
   *
   * 1ステップに複数の観察が付くことがある。気道確保ステップは
   * 「自発呼吸なし」と「気道確保後も再開せず」の2つを持ち、どちらも学習者に提示する必要がある。
   */
  details: RationaleItem[];
}

export interface Explanation {
  category: Category;
  decidingStep: DecidingStep;
  /** 全ステップをフローの順序どおりに並べたもの */
  steps: ExplanationStep[];
  /** 結論文。例 'explain.conclusion' + { category: 'I', step: 'respiratoryRate' } */
  conclusion: RationaleItem;
  /** 評価が不要だったステップ数。0 なら「不要な評価はなかった」 */
  skippedCount: number;
}

/**
 * 観察根拠を、それが属する判定ステップへ対応づける。
 * `judge` が積む `rationale` の順序と1対1に対応する。
 */
const STEP_OF_RATIONALE: Record<string, DecidingStep> = {
  'rationale.canWalk': 'walk',
  'rationale.cannotWalk': 'walk',
  'rationale.noBreathing': 'airway',
  'rationale.breathingResumed': 'airway',
  'rationale.breathingNotResumed': 'airway',
  'rationale.hasBreathing': 'airway',
  'rationale.rrLow': 'respiratoryRate',
  'rationale.rrHigh': 'respiratoryRate',
  'rationale.rrNormal': 'respiratoryRate',
  'rationale.radialPulseAbsent': 'circulation',
  'rationale.crtDelayed': 'circulation',
  'rationale.circulationOk': 'circulation',
  'rationale.doesNotObeyCommands': 'consciousness',
  'rationale.obeysCommands': 'consciousness',
};

/** `explain` が生成し得る結論キー。テストの網羅性検証に使う */
export const CONCLUSION_KEY = 'explain.conclusion';

export function explain(c: TriageCase, profile: RuleProfile): Explanation {
  const judgement: Judgement = judge(c, profile);
  return explainJudgement(judgement);
}

/** 既に判定済みの場合に再判定を避けるための入口。`explain` と同じ結果を返す */
export function explainJudgement(judgement: Judgement): Explanation {
  const { category, decidingStep, rationale } = judgement;

  // 根拠をステップ別にまとめる。観察の順序は judge が積んだ順を保つ
  const detailsByStep = new Map<DecidingStep, RationaleItem[]>();
  for (const item of rationale) {
    const step = STEP_OF_RATIONALE[item.key];
    if (step === undefined) {
      throw new Error(`explain: 未知の根拠キー ${item.key}。STEP_OF_RATIONALE に追加すること`);
    }
    const bucket = detailsByStep.get(step);
    if (bucket === undefined) detailsByStep.set(step, [item]);
    else bucket.push(item);
  }

  const decidingIndex = DECIDING_STEPS.indexOf(decidingStep);
  const steps: ExplanationStep[] = DECIDING_STEPS.map((step, index) => {
    const details = index > decidingIndex ? [] : (detailsByStep.get(step) ?? []);
    // 観察が付かないステップは評価されていない
    if (details.length === 0) return { step, status: 'skipped', details: [] };
    return { step, status: step === decidingStep ? 'decided' : 'passed', details };
  });

  return {
    category,
    decidingStep,
    steps,
    conclusion: { key: CONCLUSION_KEY, params: { category, step: decidingStep } },
    skippedCount: steps.filter((s) => s.status === 'skipped').length,
  };
}

/** `explain` が生成し得る全翻訳キー。tests/i18n.spec.ts §9-5 の網羅性検証に使う */
export const ALL_RATIONALE_KEYS: readonly string[] = Object.keys(STEP_OF_RATIONALE);
