import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";

const MODAL_EXIT_MS = 140;

interface ModalProps {
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onClose: () => void;
  onRequestClose?: () => boolean;
  children: ReactNode;
  preventClose?: boolean;
}

export function Modal({
  title,
  description,
  size = "sm",
  onClose,
  onRequestClose,
  children,
  preventClose = false,
}: ModalProps) {
  const [open, setOpen] = useState(true);
  const exitTimer = useRef<number | null>(null);
  const closing = useRef(false);

  useEffect(
    () => () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    },
    [],
  );

  function requestClose() {
    if (!open || closing.current || preventClose || onRequestClose?.() === false) return;
    closing.current = true;
    setOpen(false);
    exitTimer.current = window.setTimeout(onClose, MODAL_EXIT_MS);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && requestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal-box modal-box-${size}`}
          onEscapeKeyDown={(event) => preventClose && event.preventDefault()}
          onPointerDownOutside={(event) => preventClose && event.preventDefault()}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description>{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="ui-icon-button"
                aria-label="Close dialog"
                disabled={preventClose}
              >
                <X />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalClose({ children }: { children: ReactElement }) {
  return <Dialog.Close asChild>{children}</Dialog.Close>;
}
