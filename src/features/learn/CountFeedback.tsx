import { respiratoryBandOf, type RespiratoryBand } from '@/domain/breathing';
import type { RuleProfile, TriageCase } from '@/domain/types';
import type { CountResult } from '@/components/BreathCounter';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';
import { signedDelta } from '@/lib/format';

/**
 * 実測モードの計数フィードバック（SPEC §2.3 / docs/OBSERVATION.md §6）。
 *
 * **計数精度と区分判定を分離して提示する。** 数え値が2回ずれていても
 * 「30回以上」という判断が正しければ、トリアージとしては正解である。
 * この区別を示さないと、利用者は何を改善すべきか分からない。
 */
export interface CountFeedbackProps {
  case: TriageCase;
  count: CountResult;
  profile: RuleProfile;
}

function bandKey(band: RespiratoryBand): TranslationKey {
  if (band === 'low') return 'explain.bandLow';
  if (band === 'high') return 'explain.bandHigh';
  return 'explain.bandNormal';
}

function bandParams(band: RespiratoryBand, profile: RuleProfile): Record<string, number> {
  if (band === 'low') return { threshold: profile.respiratoryRateLowMax };
  if (band === 'high') return { threshold: profile.respiratoryRateHighMin };
  return { low: profile.respiratoryRateLowMax, high: profile.respiratoryRateHighMin };
}

export function CountFeedback({ case: c, count, profile }: CountFeedbackProps) {
  const { t } = useI18n();

  // 無呼吸の症例は数える対象がない
  if (!c.hasSpontaneousBreathing || c.respiratoryRate === null) return null;

  const actual = c.respiratoryRate;
  const estimated = count.estimatedRate;

  if (estimated === null) {
    return (
      <p className="rounded-lg bg-slate-800 p-2 text-sm text-slate-300">
        {t('explain.countNotAttempted', { actual })}
      </p>
    );
  }

  const delta = estimated - actual;
  const actualBand = respiratoryBandOf(actual, profile);
  const estimatedBand = respiratoryBandOf(estimated, profile);
  const bandText = t(bandKey(actualBand), bandParams(actualBand, profile));

  return (
    <div className="space-y-1 rounded-lg bg-slate-800 p-2 text-sm">
      <p className="font-mono tabular-nums text-slate-200">
        {delta === 0
          ? t('explain.countExact', { estimated })
          : t('explain.countAccuracy', { estimated, actual, delta: signedDelta(delta) })}
      </p>
      {delta !== 0 && (
        <p className={estimatedBand === actualBand ? 'text-green-300' : 'text-amber-300'}>
          {estimatedBand === actualBand
            ? t('explain.classificationCorrect', { band: bandText })
            : t('explain.classificationWrong', { band: bandText })}
        </p>
      )}
    </div>
  );
}
