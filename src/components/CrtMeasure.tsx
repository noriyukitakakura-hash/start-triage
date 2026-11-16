import { useCallback, useEffect, useRef, useState } from 'react';
import { CRT_PRESS_SECONDS, estimateCrtSeconds, isPressSufficient } from '@/domain/circulation';
import type { TriageCase } from '@/domain/types';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import './crt.css';

/**
 * CRT の実測（docs/OBSERVATION.md）。
 *
 * 現場の手技をそのままなぞる:
 * 1. 爪床を {@link CRT_PRESS_SECONDS} 秒間圧迫する
 * 2. 離すと爪床は白くなっている
 * 3. 色が戻るまでの秒数を自分で測る
 *
 * **圧迫が5秒に満たない計測は無効として扱う。** 毛細血管が十分に空にならず
 * 正しく測れないため。ここで手技の要点を体で覚えてもらう。
 *
 * 色が戻る速さは CSS の `transition-duration` に症例の値を渡して再現する。
 * 呼吸アニメーションと同じく、**提示する速さが真値と一致していなければ
 * 誤った数値を教えることになる**。
 */
export type CrtPhase = 'idle' | 'pressing' | 'refilling' | 'measured';

export interface CrtMeasureProps {
  case: TriageCase;
  onMeasured: (seconds: number) => void;
  measured: number | null;
}

export function CrtMeasure({ case: c, onMeasured, measured }: CrtMeasureProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState<CrtPhase>(measured === null ? 'idle' : 'measured');
  const [remaining, setRemaining] = useState(CRT_PRESS_SECONDS);
  const [tooShort, setTooShort] = useState(false);
  const pressStartRef = useRef<number | null>(null);
  const releasedAtRef = useRef<number | null>(null);

  // 押下中の残り秒数。計測そのものは performance.now() の差分で行う
  useEffect(() => {
    if (phase !== 'pressing') return;
    const id = setInterval(() => {
      const start = pressStartRef.current;
      if (start === null) return;
      const left = CRT_PRESS_SECONDS - (performance.now() - start) / 1000;
      setRemaining(Math.max(0, Number(left.toFixed(1))));
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  const startPress = useCallback(() => {
    if (phase === 'refilling' || phase === 'measured') return;
    setTooShort(false);
    pressStartRef.current = performance.now();
    setRemaining(CRT_PRESS_SECONDS);
    setPhase('pressing');
  }, [phase]);

  const endPress = useCallback(() => {
    if (phase !== 'pressing') return;
    const start = pressStartRef.current;
    const pressMs = start === null ? 0 : performance.now() - start;
    pressStartRef.current = null;

    if (!isPressSufficient(pressMs)) {
      // 圧迫不足。手技として成立していないので計測させない
      setTooShort(true);
      setPhase('idle');
      return;
    }

    releasedAtRef.current = performance.now();
    setPhase('refilling');
  }, [phase]);

  const reportReturned = useCallback(() => {
    const released = releasedAtRef.current;
    if (phase !== 'refilling' || released === null) return;
    onMeasured(estimateCrtSeconds(released, performance.now()));
    setPhase('measured');
  }, [phase, onMeasured]);

  const retry = useCallback(() => {
    releasedAtRef.current = null;
    setTooShort(false);
    setPhase('idle');
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-300">
        {t('crt.instruction', { seconds: CRT_PRESS_SECONDS })}
      </p>

      <div className="flex justify-center">
        <Fingertip
          phase={phase}
          crtSeconds={c.crtSeconds}
          reducedMotion={prefersReducedMotion}
          onPressStart={startPress}
          onPressEnd={endPress}
        />
      </div>

      <p aria-live="polite" className="min-h-10 text-center text-sm">
        {tooShort && (
          <span className="text-amber-300">{t('crt.tooShort', { seconds: CRT_PRESS_SECONDS })}</span>
        )}
        {phase === 'pressing' && (
          <span className="font-mono tabular-nums">{t('crt.pressing', { seconds: remaining })}</span>
        )}
        {phase === 'refilling' && <span>{t('crt.watching')}</span>}
        {phase === 'measured' && measured !== null && (
          <span className="font-mono text-lg tabular-nums">{t('crt.measured', { seconds: measured })}</span>
        )}
      </p>

      {phase === 'refilling' && (
        <button
          type="button"
          onClick={reportReturned}
          className="min-h-12 w-full bg-sky-600 text-base font-semibold text-white transition active:scale-95"
        >
          {t('crt.reportReturned')}
        </button>
      )}

      {phase === 'measured' && (
        <button
          type="button"
          onClick={retry}
          className="min-h-11 w-full border border-slate-600 text-sm text-slate-300 transition active:scale-95"
        >
          {t('crt.retry')}
        </button>
      )}
    </div>
  );
}

/**
 * 指先と爪床。爪の色が圧迫で白くなり、離すと `crtSeconds` かけて戻る。
 *
 * `button` にしているのは、キーボードでも操作できるようにするため。
 * Space/Enter の押下と解放がそのまま圧迫と解放に対応する。
 */
function Fingertip({
  phase,
  crtSeconds,
  reducedMotion,
  onPressStart,
  onPressEnd,
}: {
  phase: CrtPhase;
  crtSeconds: number;
  reducedMotion: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
}) {
  const { t } = useI18n();
  const blanched = phase === 'pressing' || phase === 'refilling';

  return (
    <button
      type="button"
      aria-label={t('crt.press')}
      className="crt-finger"
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
      onPointerCancel={onPressEnd}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onPressStart();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') onPressEnd();
      }}
    >
      <svg viewBox="0 0 120 160" width={140} height={187} aria-hidden focusable="false">
        {/* 指 */}
        <path
          d="M34 158 L34 58 Q34 18 60 18 Q86 18 86 58 L86 158 Z"
          className="fill-[#e8c3a8] stroke-[#c99f82]"
          strokeWidth={2}
        />
        {/* 第一関節のしわ */}
        <path d="M38 96 Q60 102 82 96" className="fill-none stroke-[#c99f82]" strokeWidth={2} strokeLinecap="round" />
        {/* 爪床。ここが圧迫で白くなり、離すと戻る */}
        <path
          d="M44 36 Q60 26 76 36 L74 72 Q60 80 46 72 Z"
          className={['crt-nail', blanched ? 'crt-nail--blanched' : ''].join(' ')}
          style={
            // 圧迫中は即座に白く、離したら症例の CRT をかけて戻す。
            // reduced-motion でも「戻るまでの時間」は情報なので残し、色変化だけを穏やかにする
            phase === 'refilling'
              ? { transitionDuration: `${crtSeconds}s`, transitionTimingFunction: reducedMotion ? 'steps(2)' : 'ease-out' }
              : { transitionDuration: '0.12s' }
          }
        />
      </svg>
    </button>
  );
}
