import { create } from "zustand";

export type ComposeKind = "new" | "reply" | "forward" | "draft";

export interface KeptAttachment {
  id: string;
  fileName: string;
  sizeBytes: string;
}

export interface ComposeDefaults {
  kind?: ComposeKind;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  html?: string;
  inReplyTo?: string;
  draftId?: string;
  fromMailboxId?: string;
  attachmentPaths?: string[];
  keptAttachments?: KeptAttachment[];
  scheduledFor?: string;
}

interface ComposeState {
  isOpen: boolean;
  defaults: ComposeDefaults;
  open: (defaults?: ComposeDefaults) => void;
  close: () => void;
}

export const useComposeStore = create<ComposeState>((set) => ({
  isOpen: false,
  defaults: {},
  open: (defaults = {}) => set({ isOpen: true, defaults }),
  close: () => set({ isOpen: false, defaults: {} }),
}));
