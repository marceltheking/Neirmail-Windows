import { create } from "zustand";

interface ToastAction {
  label: string;
  onClick: () => void;
  duration?: number;
}

export interface ActiveToast {
  id: number;
  message: string;
  kind: "ok" | "error";
  label: string;
  action?: ToastAction;
  duration: number;
}

interface ToastState {
  active: ActiveToast | null;
  last: ActiveToast | null;
  show: (message: string, action?: ToastAction) => number;
  dismiss: (id?: number) => void;
}

const PLAIN_DURATION_MS = 2600;
const ACTION_DURATION_MS = 5000;
const FAILURE_PATTERN = /^(could not|couldn't|cannot|can't|failed|unable|error|invalid)/i;

let nextId = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set, get) => ({
  active: null,
  last: null,
  show: (message, action) => {
    const id = ++nextId;
    const kind = FAILURE_PATTERN.test(message) ? "error" : "ok";
    const duration = action?.duration ?? (action ? ACTION_DURATION_MS : PLAIN_DURATION_MS);
    clearTimeout(timer);
    const toast: ActiveToast = {
      id,
      message,
      kind,
      label: kind === "error" ? "Failed" : "Done",
      action,
      duration,
    };
    set({ active: toast, last: toast });
    timer = setTimeout(() => get().dismiss(id), duration);
    return id;
  },
  dismiss: (id) => {
    const active = get().active;
    if (!active || (id !== undefined && active.id !== id)) return;
    clearTimeout(timer);
    set({ active: null });
  },
}));
