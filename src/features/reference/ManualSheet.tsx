import { Sheet } from '@/components/Sheet';
import { useI18n } from '@/i18n';
import { MeasurementManual } from './MeasurementManual';

/**
 * 測定のしかたをシートで出す（SPEC §2.1）。
 *
 * **画面遷移はしない。** 症例の途中で `/reference` へ飛ぶと、
 * 測りかけの計数も 10問モードの進行も失われる（どちらもコンポーネントの状態）。
 * シートなら背後のモードは生きたままである。
 *
 * 初回案内もこれを使う。内容を二重に書かないため。
 */
export interface ManualSheetProps {
  open: boolean;
  onClose: () => void;
  /** 初回案内として出す。閉じる操作の文言が変わる */
  firstRun?: boolean;
}

export function ManualSheet({ open, onClose, firstRun = false }: ManualSheetProps) {
  const { t } = useI18n();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('manual.heading')}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 w-full rounded-xl bg-slate-100 text-base font-semibold text-slate-900 transition active:scale-95"
        >
          {t(firstRun ? 'manual.firstRun.start' : 'common.close')}
        </button>
      }
    >
      <MeasurementManual />
    </Sheet>
  );
}
