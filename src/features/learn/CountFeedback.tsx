import { respiratoryBandOf, type RespiratoryBand } from '@/domain/breathing';
import { crtBandOf, type CrtBand } from '@/domain/circulation';
import { judge } from '@/domain/judge';
import type { RuleProfile, TriageCase } from '@/domain/types';
import type { CountResult } from '@/domain/tapCounting';
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
  /** 利用者が測った CRT（秒）。未測定は null */
  measuredCrt?: number | null;
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

export function CountFeedback({ case: c, count, profile, measuredCrt = null }: CountFeedbackProps) {
  // **評価されなかった項目のフィードバックは出さない。**
  // 歩行可能で確定した症例に「CRTは2.8秒でした」と言っても雑音にしかならず、
  // 「判定に不要な情報を無視できる」という訓練の趣旨にも反する
  const { decidingStep } = judge(c, profile);
  const respiratoryEvaluated =
    decidingStep === 'respiratoryRate' ||
    decidingStep === 'circulation' ||
    decidingStep === 'consciousness';
  const circulationEvaluated = decidingStep === 'circulation' || decidingStep === 'consciousness';

  return (
    <div className="space-y-1">
      {respiratoryEvaluated && <RespiratoryFeedback case={c} count={count} profile={profile} />}
      {/* 測ったなら、評価外の項目でも結果は返す */}
      {(circulationEvaluated || measuredCrt !== null) && (
        <CrtFeedback case={c} profile={profile} measuredCrt={measuredCrt} />
      )}
    </div>
  );
}

function RespiratoryFeedback({ case: c, count, profile }: CountFeedbackProps) {
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

/** CRT の計測誤差。呼吸数と同じく、計測精度と区分判定を分離して示す */
function crtBandKey(band: CrtBand): TranslationKey {
  return band === 'delayed' ? 'explain.crtBandDelayed' : 'explain.crtBandWithinRange';
}

function CrtFeedback({
  case: c,
  profile,
  measuredCrt,
}: {
  case: TriageCase;
  profile: RuleProfile;
  measuredCrt: number | null;
}) {
  const { t } = useI18n();
  const actual = c.crtSeconds;

  if (measuredCrt === null) {
    return (
      <p className="bg-slate-800 p-2 text-sm text-slate-300">
        {t('explain.crtNotMeasured', { actual: actual.toFixed(1) })}
      </p>
    );
  }

  const delta = Number((measuredCrt - actual).toFixed(1));
  const actualBand = crtBandOf(actual, profile);
  const measuredBand = crtBandOf(measuredCrt, profile);
  const bandText = t(crtBandKey(actualBand), { threshold: profile.crtThresholdSeconds });

  return (
    <div className="space-y-1 bg-slate-800 p-2 text-sm">
      <p className="font-mono tabular-nums text-slate-200">
        {delta === 0
          ? t('explain.crtExact', { measured: measuredCrt.toFixed(1) })
          : t('explain.crtAccuracy', {
              measured: measuredCrt.toFixed(1),
              actual: actual.toFixed(1),
              delta: signedDelta(delta),
            })}
      </p>
      {delta !== 0 && (
        <p className={measuredBand === actualBand ? 'text-green-300' : 'text-amber-300'}>
          {measuredBand === actualBand
            ? t('explain.crtBandCorrect', { band: bandText })
            : t('explain.crtBandWrong', { band: bandText })}
        </p>
      )}
    </div>
  );
}
