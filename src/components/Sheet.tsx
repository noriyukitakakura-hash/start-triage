import { useCallback, useEffect, useRef, type ReactNode } from 'react';

/**
 * 下から出る共通シート（docs/SPEC.md §5.1）。
 *
 * ネイティブの `<dialog>` + `showModal()` を使う。フォーカストラップ・Esc での閉じ・
 * `::backdrop`・不活性化が標準で手に入り、自前実装より堅い。
 *
 * **ページ本体はスクロールさせない。** 長い内容はこのシートの内部だけがスクロールする。
 */
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** 見出し。`aria-label` にも使う */
  title: string;
  /** 見出しを視覚的に隠す（解説シートのように結果表示が主役の場合） */
  hideTitle?: boolean;
  /** Esc と背景タップでの閉じを禁止する（初回の免責確認など） */
  dismissible?: boolean;
  children: ReactNode;
  /** 下部に固定する操作（「次の症例」など）。内容が長くても常に押せる */
  footer?: ReactNode;
}

export function Sheet({
  open,
  onClose,
  title,
  hideTitle = false,
  dismissible = true,
  children,
  footer,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Esc は dialog 自身が発火させる。cancel を止めれば閉じない
  const handleCancel = useCallback(
    (event: React.SyntheticEvent<HTMLDialogElement>) => {
      if (!dismissible) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      onClose();
    },
    [dismissible, onClose],
  );

  // 背景（::backdrop）のクリックは dialog 要素自身へのクリックとして届く
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (!dismissible) return;
      if (event.target === ref.current) onClose();
    },
    [dismissible, onClose],
  );

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={handleCancel}
      onClick={handleClick}
      className="sheet"
    >
      {/* 閉じている間は中身を描画しない。隠れたフォーカス可能要素を残さないため */}
      {open && (
        <div className="sheet__panel" onClick={(e) => e.stopPropagation()}>
          <div className="sheet__body">
            <h2 className={hideTitle ? 'sr-only' : 'mb-2 text-base font-bold'}>{title}</h2>
            {children}
          </div>
          {footer !== undefined && <div className="sheet__footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
