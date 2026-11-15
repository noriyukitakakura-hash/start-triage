import '@testing-library/jest-dom/vitest';

/**
 * jsdom 28 は `<dialog>` の showModal / close を実装していない。
 * アプリ側は標準 API を使う方針（フォーカストラップと ::backdrop を自前実装しないため）なので、
 * テスト環境側で最小限を補う。
 */
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement, returnValue?: string) {
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };
}
