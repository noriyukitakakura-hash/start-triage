import { Sheet } from '@/components/Sheet';
import { useI18n } from '@/i18n';

/**
 * 免責と判定基準の提示（SPEC §1.7）。
 *
 * 初回起動時に**明示的な確認を求める**。画面の片隅に小さく常時表示するより
 * 確実に読まれ、医療教育アプリとして妥当な形である。
 * 設定シートからいつでも再読できるため、到達性は失われない。
 */
export interface DisclaimerDialogProps {
  open: boolean;
  /** 初回確認では閉じられない。設定からの再読では閉じられる */
  requireAcknowledgement: boolean;
  onAcknowledge: () => void;
  onClose: () => void;
}

export function DisclaimerDialog({
  open,
  requireAcknowledgement,
  onAcknowledge,
  onClose,
}: DisclaimerDialogProps) {
  const { t } = useI18n();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('disclaimer.heading')}
      dismissible={!requireAcknowledgement}
      footer={
        <button
          type="button"
          onClick={requireAcknowledgement ? onAcknowledge : onClose}
          className="min-h-12 w-full rounded-xl bg-slate-100 text-base font-semibold text-slate-900 transition active:scale-95"
        >
          {requireAcknowledgement ? t('disclaimer.acknowledge') : t('settings.close')}
        </button>
      }
    >
      <div className="space-y-2 text-sm leading-relaxed text-slate-200">
        <p>{t('disclaimer.training')}</p>
        <p>{t('disclaimer.criteria')}</p>
      </div>
    </Sheet>
  );
}
