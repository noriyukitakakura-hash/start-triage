import type { ReactNode } from 'react';

/**
 * 計測器セルの共通の骨格（SPEC §5.1, §5.3）。
 *
 * 3 つのセルで高さを揃える。揃っていないと視線が落ち着かず、
 * どれが未測定なのかも読み取りにくい。
 *
 * - `figure` 図または主たる読み取り（56px）
 * - `readout` 数値（28px、2行まで）
 * - `action`  操作（44px。タッチ目標の下限）
 *
 * **見出し要素は使わない。** ラベルは `role="group"` の `aria-label` が担う。
 * `<h3>` を置くと `<h1>` から階層が飛び、読み上げの見出し送りが壊れる。
 * また操作のまとまりは見出しで区切る対象ではなく、`group` が適切。
 */

/** 数値モードのセルと高さを揃えるための寸法。片方だけ変えると配置がずれる */
export const INSTRUMENT_HEIGHT = 'h-[150px]';

export interface InstrumentProps {
  label: string;
  figure?: ReactNode;
  readout: ReactNode;
  action?: ReactNode;
}

export function Instrument({ label, figure, readout, action }: InstrumentProps) {
  return (
    <div role="group" aria-label={label} className={`flex min-w-0 flex-col bg-slate-800 ${INSTRUMENT_HEIGHT}`}>
      <p aria-hidden className="truncate px-1.5 pt-1 text-[10px] leading-none text-slate-400">
        {label}
      </p>

      <div className="flex h-14 items-center justify-center px-1">{figure}</div>

      <div className="flex h-7 items-center justify-center px-1 text-center">{readout}</div>

      <div className="p-1">{action ?? <div className="h-11" />}</div>
    </div>
  );
}

/** 計測器の操作ボタン。3セルで見た目を揃える */
export function InstrumentButton({
  children,
  onClick,
  disabled = false,
  tone = 'primary',
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'quiet';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'h-11 w-full text-xs font-semibold transition active:scale-95 disabled:opacity-45',
        tone === 'primary' ? 'bg-sky-700 text-white' : 'border border-slate-600 text-slate-300',
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
