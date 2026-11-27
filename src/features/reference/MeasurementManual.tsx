import { CRT_PRESS_SECONDS } from '@/domain/circulation';
import { MIN_ESTIMATE_MS } from '@/domain/breathing';
import { MIN_TAPS_FOR_ESTIMATE } from '@/domain/tapCounting';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';

/**
 * 測定のしかた（SPEC §2.1 / S5、docs/OBSERVATION.md §6）。
 *
 * **「ボタンを押せば結果が出る」と誤解された実績がある。**
 * 実際には計測ボタンはタップ対象そのもので、押した回数と間隔から値が決まる。
 * 先頭でその誤解を名指しで否定する。
 *
 * **「壊れて見えるが仕様」の2点を必ず書く。**
 * 推定値が条件を満たすまで「—」のままなのと、触知不能では何も動かずボタンも出ないこと。
 * ここが抜けると、マニュアルがあっても同じ誤解が残る。
 *
 * 内容だけを返し、見出しの外枠やスクロール領域は持たない。
 * リファレンス画面とシートの両方に同じものを埋め込むためである
 * （二重に書くと必ずずれる）。
 */

interface Procedure {
  /** 小見出し */
  titleKey: TranslationKey;
  /** 手順。順序付きリストで出す */
  stepKeys: readonly TranslationKey[];
  /** 補足。「壊れて見えるが仕様」はここに置く */
  noteKey?: TranslationKey;
  params?: Record<string, string | number>;
}

export function MeasurementManual() {
  const { t } = useI18n();

  const procedures: readonly Procedure[] = [
    {
      titleKey: 'observation.heading',
      stepKeys: ['observation.instruction', 'manual.breath.estimate'],
      noteKey: 'manual.breath.dashIsNormal',
      params: { taps: MIN_TAPS_FOR_ESTIMATE, seconds: MIN_ESTIMATE_MS / 1000 },
    },
    {
      titleKey: 'crt.heading',
      stepKeys: ['crt.instruction', 'manual.crt.release'],
      noteKey: 'crt.tooShort',
      params: { seconds: CRT_PRESS_SECONDS },
    },
    {
      titleKey: 'pulse.heading',
      stepKeys: ['pulse.instruction'],
      noteKey: 'manual.pulse.notPalpable',
    },
    {
      titleKey: 'manual.consciousness.heading',
      stepKeys: ['manual.consciousness.ask'],
      noteKey: 'manual.consciousness.obeying',
    },
  ];

  return (
    <div>
      <div className="space-y-2 text-sm leading-relaxed text-slate-200">
        {/* 報告された誤解をそのまま打ち消す。ここが本文の要点である */}
        <p className="font-semibold">{t('manual.lead')}</p>
        <p>{t('manual.leadRole')}</p>
      </div>

      <ul className="mt-2 space-y-1">
        {procedures.map((procedure) => (
          <li key={procedure.titleKey} className="border border-slate-700 bg-slate-800 px-2 py-1.5">
            {/*
              見出し要素は使わない。判定フローの節が同じ位置に
              `text-xs font-semibold text-sky-300` の段落を置いており、
              それに揃えることで見出し階層を乱さない
            */}
            <p className="text-xs font-semibold text-sky-300">{t(procedure.titleKey)}</p>
            <ol className="list-inside list-decimal text-sm leading-tight">
              {procedure.stepKeys.map((key) => (
                <li key={key}>{t(key, procedure.params)}</li>
              ))}
            </ol>
            {procedure.noteKey !== undefined && (
              <p className="mt-0.5 text-[11px] leading-tight text-amber-200">
                {t(procedure.noteKey, procedure.params)}
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-1 text-[11px] leading-tight text-slate-400">{t('manual.allOptional')}</p>
    </div>
  );
}
