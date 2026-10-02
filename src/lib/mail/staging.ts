import { clearStagedAttachments } from "../api/endpoints/attachments";
import { useComposeStore } from "../state/composeStore";
import { outgoingCount } from "./outbox";

export function releaseStagedAttachments(): void {
  setTimeout(() => {
    if (outgoingCount() > 0 || useComposeStore.getState().isOpen) return;
    void clearStagedAttachments().catch(() => undefined);
  }, 0);
}
