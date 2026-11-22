import { breathingPatternOf } from '@/domain/breathing';
import type { TriageCase } from '@/domain/types';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { useI18n } from '@/i18n';
import { breathAnimationFor } from './breathing';
import { FIGURES, FIGURE_VIEWBOX, Ground, HeadGroup } from './figures';
import { appearanceFor } from './appearance';
import './breathing.css';

export interface PatientFigureProps {
  case: TriageCase;
  /**
   * 呼吸アニメーションを動かすか。
   * 実測モードのみ true にする。数値モードでは呼吸数を数値で提示するため動かさない。
   */
  animate: boolean;
  className?: string;
}

/**
 * 傷病者イラストを描画し、実測モードでは胸郭を呼吸数どおりに動かす。
 *
 * - 無呼吸の症例にはアニメーションを一切付与しない。**静止そのものが手がかりである**
 * - `prefers-reduced-motion: reduce` では動かさない。呼吸数を数値で提示する責務は
 *   呼び出し側（VitalsPanel）が負う（docs/OBSERVATION.md §3.5）
 * - `aria-label` は答えを漏らさない中立な文言にとどめる（SPEC §5.3）。
 *   状況文はイラストの外に別途表示される
 */
export function PatientFigure({ case: c, animate, className }: PatientFigureProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();

  const parts = FIGURES[c.patient.illustrationId];
  if (parts === undefined) {
    throw new Error(
      `PatientFigure: イラスト ${c.patient.illustrationId} が未実装。figures.tsx の FIGURES に追加すること`,
    );
  }

  const pattern = breathingPatternOf(c);
  const animation = breathAnimationFor(pattern, c.respiratoryRate);
  const shouldAnimate = animate && !prefersReducedMotion && animation !== null;

  /*
   * 体格。**人物だけ**を接地点を支点に拡縮する。
   *
   * `.chest` は `transform-box: fill-box` なので、`transform-origin: center bottom` は
   * **その要素自身のローカル座標系**のバウンディングボックスに対して解決される。
   * 祖先の transform は影響しないため、ここで包んでも呼吸の向きも振幅も変わらない。
   */
  const appearance = appearanceFor(c.id);
  const scale = parts.fixedScale === true ? 1 : appearance.buildScale;
  const buildTransform =
    scale === 1
      ? undefined
      : `translate(100 ${parts.groundY}) scale(${scale}) translate(-100 ${-parts.groundY})`;

  const chestProps = shouldAnimate
    ? {
        className: ['chest', animation.modifierClass].filter((v) => v !== null).join(' '),
        style: {
          animationDuration: `${animation.durationSeconds}s`,
          // 振幅はパターンごとに異なる。breathing.css のキーフレームが参照する
          ['--breath-amp' as string]: String(animation.amplitude),
        },
        'data-breathing-pattern': pattern,
      }
    : { 'data-breathing-pattern': pattern };

  return (
    <svg
      viewBox={FIGURE_VIEWBOX}
      role="img"
      aria-label={t('patient.figureLabel')}
      /* 親の高さに追従させる。preserveAspectRatio の既定（xMidYMid meet）で縦横比を保つ */
      className={['patient-figure', 'h-full w-full', className].filter(Boolean).join(' ')}
    >
      {/* 地面は拡縮の外。人物が大柄でも地面まで広がっては意味が変わる */}
      <Ground y={parts.groundY} />
      <g transform={buildTransform}>
        {parts.behind}
        {/*
        傾きは `.chest` の**外側**で与える。内側で回すと `.chest` の
        バウンディングボックスが回転後の軸平行外接矩形になり、
        `transform-origin: center bottom` が横隔膜ではなく最下の角を指す
      */}
        {parts.chestRotate === undefined ? (
          <g {...chestProps}>{parts.chest}</g>
        ) : (
          <g transform={`rotate(${parts.chestRotate.deg} ${parts.chestRotate.cx} ${parts.chestRotate.cy})`}>
            <g {...chestProps}>{parts.chest}</g>
          </g>
        )}
        {parts.front}
        <HeadGroup head={parts.head} hair={appearance.hair} />
      </g>
    </svg>
  );
}
