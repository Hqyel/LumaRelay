import { Button } from "./button.js";
import { Dialog } from "./dialog.js";

export interface ConfirmDangerDialogProps {
  busy?: boolean;
  confirmLabel?: string;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function ConfirmDangerDialog({
  busy = false,
  confirmLabel = "确认",
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmDangerDialogProps) {
  return (
    <Dialog
      description={description}
      footer={
        <>
          <Button
            disabled={busy}
            onClick={() => onOpenChange(false)}
            variant="secondary"
          >
            取消
          </Button>
          <Button disabled={busy} onClick={onConfirm} variant="danger">
            {busy ? "处理中…" : confirmLabel}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    >
      <p className="text-small text-warning">此操作可能无法撤销。</p>
    </Dialog>
  );
}
