"use client";

import { Modal } from "./modal";
import { useLocale } from "@/lib/locale-context";

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
}) {
  const { t } = useLocale();

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="mb-6 text-sm text-muted">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-accent hover:text-foreground"
        >
          {t.common.cancel}
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          {t.common.delete}
        </button>
      </div>
    </Modal>
  );
}
