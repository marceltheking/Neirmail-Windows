import { useState } from "react";
import { Modal, ModalClose } from "../shared/Modal";
import { ApiError } from "../../lib/api/types";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";

interface FolderModalProps {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function FolderModal({ onClose, onCreate }: FolderModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (busy) return;
    if (!name.trim()) {
      setError("Enter a folder name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that folder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New folder" onClose={onClose}>
      <form
        className="folder-modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <Field
          label="Folder name"
          type="text"
          placeholder="Folder name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <ModalClose>
            <Button variant="ghost">Cancel</Button>
          </ModalClose>
          <Button type="submit" loading={busy}>
            Create folder
          </Button>
        </div>
      </form>
    </Modal>
  );
}
