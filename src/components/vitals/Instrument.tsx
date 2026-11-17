import type { ReactNode } from 'react';

/**
 * 計測器セルの共通の骨格（SPEC §5.1）。
 *
 * 3 つのセルで高さを揃える。揃っていないと視線が落ち着かず、
 * どれが未測定なのかも読み取りにくい。
 *
 * - `figure` 図または主たる読み取り（56px）
 * - `readout` 数値（26px、2行まで）
 * - `action`  操作（44px。タッチ目標の下限）
 */
export interface InstrumentProps {
  label: string;
  figure?: ReactNode;
  readout: ReactNode;
  action?: ReactNode;
}

export function Instrument({ label, figure, readout, action }: InstrumentProps) {
  return (
    <section aria-label={label} className="flex min-w-0 flex-col bg-slate-800">
      <h3 className="truncate px-1.5 pt-1 text-[10px] leading-none text-slate-400">{label}</h3>

      <div className="flex h-14 items-center justify-center px-1">{figure}</div>

      <div className="flex h-7 items-center justify-center px-1 text-center">{readout}</div>

      <div className="p-1">{action ?? <div className="h-11" />}</div>
    </section>
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
        tone === 'primary' ? 'bg-sky-600 text-white' : 'border border-slate-600 text-slate-300',
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
