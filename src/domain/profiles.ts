import type { RuleProfile } from './types';

/**
 * 日本・消防庁標準のSTART法。**v1で採用する唯一のプロファイル**（SPEC §3.2）。
 * 呼吸数は 9回以下 または 30回以上 を I類とする。
 */
export const JP_FDMA: RuleProfile = {
  id: 'JP-FDMA',
  respiratoryRateLowMax: 9,
  respiratoryRateHighMin: 30,
  crtThresholdSeconds: 2,
  useRadialPulse: true,
};

/**
 * 米国版START原典。**v1では未使用**。
 * 呼吸数は 30回超のみを I類とし、下限による判定を行わない。
 *
 * 将来UIに露出させる場合も、言語選択とは別の明示的な設定項目として提供すること
 * （docs/I18N.md §2）。言語切替に連動させてはならない。
 */
export const US_START: RuleProfile = {
  id: 'US-START',
  respiratoryRateLowMax: -1, // 下限による判定を行わない（呼吸数は必ずこれを上回る）
  respiratoryRateHighMin: 31,
  crtThresholdSeconds: 2,
  useRadialPulse: true,
};

export const DEFAULT_PROFILE = JP_FDMA;
