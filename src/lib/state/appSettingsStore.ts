import { create } from "zustand";
import { callCommand } from "../api/client";

const STORAGE_KEY = "neirmail-app-settings";

export const AUTO_LOCK_CHOICES = [0, 5, 15, 30, 60, 240] as const;

interface AppSettings {
  closeToTray: boolean;
  notificationPreview: boolean;
  notificationSound: boolean;
  autoLockMinutes: number;
}

interface AppSettingsState extends AppSettings {
  update: (values: Partial<AppSettings>) => void;
}

const defaults: AppSettings = {
  closeToTray: true,
  notificationPreview: true,
  notificationSound: true,
  autoLockMinutes: 30,
};

function readSettings(): AppSettings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof stored !== "object" || stored === null) return defaults;
    const record = stored as Record<string, unknown>;
    return {
      closeToTray:
        typeof record.closeToTray === "boolean" ? record.closeToTray : defaults.closeToTray,
      notificationPreview:
        typeof record.notificationPreview === "boolean"
          ? record.notificationPreview
          : defaults.notificationPreview,
      notificationSound:
        typeof record.notificationSound === "boolean"
          ? record.notificationSound
          : defaults.notificationSound,
      autoLockMinutes: (AUTO_LOCK_CHOICES as readonly unknown[]).includes(record.autoLockMinutes)
        ? (record.autoLockMinutes as number)
        : defaults.autoLockMinutes,
    };
  } catch {
    return defaults;
  }
}

const initial = readSettings();

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  ...initial,
  update: (values) => {
    const next = { ...get(), ...values };
    const settings: AppSettings = {
      closeToTray: next.closeToTray,
      notificationPreview: next.notificationPreview,
      notificationSound: next.notificationSound,
      autoLockMinutes: next.autoLockMinutes,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
    set(settings);
    if (values.closeToTray !== undefined) {
      void callCommand("set_close_to_tray", { enabled: values.closeToTray }).catch(() => undefined);
    }
  },
}));

export function initializeAppSettings() {
  void callCommand("set_close_to_tray", { enabled: initial.closeToTray }).catch(() => undefined);
}
