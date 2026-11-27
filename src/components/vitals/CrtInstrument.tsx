import { CRT_PRESS_SECONDS } from '@/domain/circulation';
import type { TriageCase } from '@/domain/types';
import { useI18n } from '@/i18n';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { Instrument, InstrumentButton } from './Instrument';
import { useCrtMeasurement, type CrtPhase } from './useCrtMeasurement';

/**
 * CRT の計測（docs/OBSERVATION.md §3.4）。
 *
 * **図の領域全体を押下対象にする。** 爪そのものを対象にすると 28px 程度となり
 * タッチ目標として小さすぎるため、セルの図領域を押下対象にして中に指と爪を描く。
 *
 * 色が戻る速さは症例の値を `transition-duration` に渡して再現する。
 * **提示する速さが真値と一致していなければ誤った数値を教えることになる。**
 *
 * **圧迫中の残り秒数だけはセルの外（上）に出す。** 読み取り欄は図のすぐ下にあり、
 * スマートフォンで爪を押すと、押している指とその付け根が覆ってしまって読めない。
 * 指は接触点より下に伸びるため、上へ逃がすほかない。
 * セルの上辺より外に絶対配置するので高さは増えず、スクロールも生まれない。
 */
export interface CrtInstrumentProps {
  case: TriageCase;
  onMeasured: (seconds: number) => void;
  measured: number | null;
}

export function CrtInstrument({ case: c, onMeasured, measured }: CrtInstrumentProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const crt = useCrtMeasurement(onMeasured);
  const pressing = crt.phase === 'pressing';

  return (
    <Instrument
      label={t('vital.crt')}
      figure={
        <Nail
          phase={crt.phase}
          crtSeconds={c.crtSeconds}
          reducedMotion={prefersReducedMotion}
          onPressStart={crt.startPress}
          onPressEnd={crt.endPress}
        />
      }
      readout={
        /*
          読み上げ用の領域は同じ要素のまま位置だけを変える。要素ごと差し替えると
          live region が作り直され、読み上げが落ちることがある
        */
        <span
          aria-live="polite"
          className={
            pressing
              ? 'pointer-events-none absolute inset-x-0 bottom-full z-10 mb-2 border border-sky-500 bg-slate-950 px-1 py-1.5 text-center leading-tight'
              : 'text-center text-[11px] leading-tight'
          }
        >
          {crt.tooShort && (
            <span className="text-amber-300">{t('crt.tooShortShort', { seconds: CRT_PRESS_SECONDS })}</span>
          )}
          {pressing && (
            <span className="font-mono text-sm font-semibold tabular-nums text-sky-200">
              {t('crt.remaining', { seconds: crt.remaining })}
            </span>
          )}
          {crt.phase === 'refilling' && <span className="text-slate-400">{t('crt.watchingShort')}</span>}
          {crt.phase === 'measured' && measured !== null && (
            <span className="font-mono text-sm font-semibold tabular-nums">
              {measured.toFixed(1)} {t('vital.crt.unit')}
            </span>
          )}
          {crt.phase === 'idle' && !crt.tooShort && <span className="text-slate-400">—</span>}
        </span>
      }
      action={
        crt.phase === 'refilling' ? (
          <InstrumentButton onClick={crt.reportReturned}>{t('crt.reportReturned')}</InstrumentButton>
        ) : crt.phase === 'measured' ? (
          <InstrumentButton onClick={crt.retry} tone="quiet">
            {t('crt.retry')}
          </InstrumentButton>
        ) : (
          /*
           * 押下対象は図の領域ただ一つにする。操作欄にも押せるボタンを置くと
           * 同じ名前の操作が二つ並び、どちらを押すのか迷わせる。
           * ここは押し方を示す説明に留め、高さだけ揃える。
           */
          <p
            id="crt-press-hint"
            className="flex h-11 items-center justify-center text-center text-[11px] leading-tight text-slate-400"
          >
            {t('crt.pressHint', { seconds: CRT_PRESS_SECONDS })}
          </p>
        )
      }
    />
  );
}

/** 指先と爪床。押下中は白く、離すと症例の秒数をかけて戻る */
function Nail({
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
  /*
   * **白くするのは圧迫中だけ。** 離した時点でこの指定を外すことで、
   * fill が元の色へ向かって遷移し始める。遷移にかかる時間は下の
   * transitionDuration（症例の crtSeconds）が決める。
   * refilling でも白のままにすると行き先が変わらず、色が永久に戻らない。
   */
  const blanched = phase === 'pressing';

  return (
    <button
      type="button"
      aria-label={t('crt.press')}
      // 5秒押すという手技はラベルではなく説明として渡す。
      // ラベルを長くすると、既に名前で引いている箇所の意味が変わる
      aria-describedby="crt-press-hint"
      className="crt-target"
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
      <svg viewBox="0 0 60 56" width={60} height={56} aria-hidden focusable="false">
        {/* 指先。セルに収まるよう先端だけを描く */}
        <path
          d="M14 56 L14 22 Q14 4 30 4 Q46 4 46 22 L46 56 Z"
          className="fill-[#e8c3a8] stroke-[#c99f82]"
          strokeWidth={1.5}
        />
        <path d="M17 42 Q30 46 43 42" className="fill-none stroke-[#c99f82]" strokeWidth={1.5} strokeLinecap="round" />
        <path
          d="M20 15 Q30 9 40 15 L39 32 Q30 37 21 32 Z"
          className={['crt-nail', blanched ? 'crt-nail--blanched' : ''].join(' ')}
          style={
            phase === 'refilling'
              ? {
                  transitionDuration: `${crtSeconds}s`,
                  transitionTimingFunction: reducedMotion ? 'steps(2)' : 'ease-out',
                }
              : { transitionDuration: '0.12s' }
          }
        />
      </svg>
    </button>
  );
}
