import type { Category, DecidingStep, Judgement, RationaleItem, RuleProfile, TriageCase } from './types';

/** 症例データが矛盾している場合に投げる。誤った区分を黙って返すより即座に失敗させる */
export class InconsistentCaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InconsistentCaseError';
  }
}

function decided(category: Category, decidingStep: DecidingStep, rationale: RationaleItem[]): Judgement {
  return { category, decidingStep, rationale };
}

/**
 * START法による一次トリアージ判定（SPEC §3.2）。
 *
 * 純関数。表示文字列を返さず、判定根拠は翻訳キーとパラメータの組で返す（docs/I18N.md §5）。
 *
 * 基準値はすべて `profile` から取る。**表示言語は判定に一切影響しない**（docs/I18N.md §2）。
 *
 * `pulseRate` は判定に使用しない。JP-FDMA の循環評価は CRT と橈骨動脈の触知可否で行い、
 * 脈拍数は利用者に提示する参考値である（SPEC §3.2 手順4）。
 *
 * @throws {InconsistentCaseError} 症例データが矛盾している場合
 */
export function judge(c: TriageCase, profile: RuleProfile): Judgement {
  const rationale: RationaleItem[] = [];

  // 手順1: 歩行可能か
  if (c.canWalk) {
    rationale.push({ key: 'rationale.canWalk' });
    return decided('III', 'walk', rationale);
  }
  rationale.push({ key: 'rationale.cannotWalk' });

  // 手順2: 自発呼吸はあるか → なければ気道確保の結果で確定
  if (!c.hasSpontaneousBreathing) {
    if (c.breathingAfterAirway === null) {
      throw new InconsistentCaseError(
        `case ${c.id}: hasSpontaneousBreathing が false なら breathingAfterAirway は null であってはならない`,
      );
    }
    rationale.push({ key: 'rationale.noBreathing' });

    if (c.breathingAfterAirway) {
      rationale.push({ key: 'rationale.breathingResumed' });
      return decided('I', 'airway', rationale);
    }
    rationale.push({ key: 'rationale.breathingNotResumed' });
    return decided('0', 'airway', rationale);
  }
  rationale.push({ key: 'rationale.hasBreathing' });

  // 手順3: 呼吸数
  if (c.respiratoryRate === null) {
    throw new InconsistentCaseError(
      `case ${c.id}: hasSpontaneousBreathing が true なら respiratoryRate は null であってはならない`,
    );
  }
  const rr = c.respiratoryRate;
  if (rr <= profile.respiratoryRateLowMax) {
    rationale.push({ key: 'rationale.rrLow', params: { rr, threshold: profile.respiratoryRateLowMax } });
    return decided('I', 'respiratoryRate', rationale);
  }
  if (rr >= profile.respiratoryRateHighMin) {
    rationale.push({ key: 'rationale.rrHigh', params: { rr, threshold: profile.respiratoryRateHighMin } });
    return decided('I', 'respiratoryRate', rationale);
  }
  rationale.push({
    key: 'rationale.rrNormal',
    params: { rr, low: profile.respiratoryRateLowMax, high: profile.respiratoryRateHighMin },
  });

  // 手順4: 循環（CRT遅延 または 橈骨動脈触知不能）
  if (profile.useRadialPulse && !c.radialPulsePalpable) {
    rationale.push({ key: 'rationale.radialPulseAbsent' });
    return decided('I', 'circulation', rationale);
  }
  if (c.crtSeconds >= profile.crtThresholdSeconds) {
    rationale.push({
      key: 'rationale.crtDelayed',
      params: { crt: c.crtSeconds, threshold: profile.crtThresholdSeconds },
    });
    return decided('I', 'circulation', rationale);
  }
  rationale.push({
    key: 'rationale.circulationOk',
    params: { crt: c.crtSeconds, threshold: profile.crtThresholdSeconds },
  });

  // 手順5: 意識（簡単な指示に従えるか）
  if (!c.obeysCommands) {
    rationale.push({ key: 'rationale.doesNotObeyCommands' });
    return decided('I', 'consciousness', rationale);
  }
  rationale.push({ key: 'rationale.obeysCommands' });
  return decided('II', 'consciousness', rationale);
}
