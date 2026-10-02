import type { ReactNode } from "react";
import { Warning } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { Modal, ModalClose } from "./Modal";

interface ConfirmationDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  danger?: boolean;
  detail?: ReactNode;
}

export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  busy = false,
  danger = true,
  detail,
}: ConfirmationDialogProps) {
  return (
    <Modal title={title} description={description} size="sm" onClose={onCancel} preventClose={busy}>
      <div className="confirmation-dialog">
        {detail && (
          <div className="confirmation-detail">
            <Warning weight="fill" />
            <span>{detail}</span>
          </div>
        )}
        <div className="modal-actions">
          <ModalClose>
            <Button variant="ghost" disabled={busy}>
              Cancel
            </Button>
          </ModalClose>
          <Button variant={danger ? "danger" : "primary"} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
