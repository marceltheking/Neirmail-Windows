import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { callCommand } from "../api/client";
import { queryClient } from "../queryClient";
import { isPermissionGranted } from "@tauri-apps/plugin-notification";
import { getPreferences } from "../api/endpoints/settings";
import { listEmails } from "../api/endpoints/emails";
import { useAppSettingsStore } from "../state/appSettingsStore";
import type { Folder, Preferences } from "../api/types";

const PREVIEW_CANDIDATES = 10;

let unlisten: UnlistenFn | null = null;
let startPromise: Promise<void> | null = null;
let lifecycleVersion = 0;
let permissionGranted = false;
let lastNotifiedId: string | null = null;
let previewsHidden = false;

export function setNotificationPreviewsHidden(hidden: boolean): void {
  previewsHidden = hidden;
}

const SILENT_FOLDER_TYPES = new Set<Folder["type"]>(["sent", "drafts", "spam", "trash", "archive"]);

interface MailEventPayload {
  type?: string;
  folderId?: string;
}

function parsePayload(payload: unknown): MailEventPayload {
  if (typeof payload !== "string") return {};
  try {
    return JSON.parse(payload) as MailEventPayload;
  } catch {
    return {};
  }
}

function isWindowInForeground(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

async function hasNotificationPermission(): Promise<boolean> {
  if (permissionGranted) return true;
  permissionGranted = await isPermissionGranted();
  return permissionGranted;
}

function isSilentFolder(folderId?: string): boolean {
  if (!folderId) return false;
  const folders = queryClient.getQueryData<Folder[]>(["folders"]);
  const folder = folders?.find((item) => item.id === folderId);
  return folder ? SILENT_FOLDER_TYPES.has(folder.type) : false;
}

async function notifyForNewMail(folderId?: string) {
  if (isWindowInForeground() || isSilentFolder(folderId)) return;
  const cached = queryClient.getQueryData<Preferences>(["preferences"]);
  const preferences = cached ?? (await getPreferences());
  queryClient.setQueryData(["preferences"], preferences);
  if (!preferences.desktopNotificationsEnabled) return;
  if (!(await hasNotificationPermission())) return;
  const { notificationPreview, notificationSound } = useAppSettingsStore.getState();
  if (!notificationPreview || previewsHidden || !folderId) {
    await callCommand("show_native_notification", {
      title: "New message",
      body: "Open Neir Mail to read it.",
      sound: notificationSound,
    });
    return;
  }
  const result = await listEmails({ folderId, limit: PREVIEW_CANDIDATES, sort: "date_desc" });
  const message = result.emails.find((email) => !email.isPinned);
  if (!message || message.id === lastNotifiedId) return;
  lastNotifiedId = message.id;
  await callCommand("show_native_notification", {
    title: message.senderName || message.senderAddress,
    body: message.subject || "New message",
    sound: notificationSound,
  });
}

export async function startMailEvents(): Promise<void> {
  if (unlisten) return;
  if (startPromise) return startPromise;

  const version = lifecycleVersion;
  const operation = beginMailEvents(version);
  startPromise = operation;
  void operation.then(
    () => clearStartOperation(operation),
    () => clearStartOperation(operation),
  );
  return operation;
}

export async function stopMailEvents(): Promise<void> {
  lifecycleVersion += 1;
  permissionGranted = false;
  lastNotifiedId = null;
  if (startPromise) {
    try {
      await startPromise;
    } catch {}
  }
  try {
    await callCommand("stop_ws");
  } catch {}
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
}

function refreshMailbox(): void {
  void queryClient.invalidateQueries({ queryKey: ["emails"] });
  void queryClient.invalidateQueries({ queryKey: ["folders"] });
}

async function listenToMail(): Promise<UnlistenFn> {
  const stopEvents = await listen("mail-event", async (event) => {
    const payload = parsePayload(event.payload);
    refreshMailbox();
    if (payload.type !== "new-mail") return;
    try {
      await notifyForNewMail(payload.folderId);
    } catch {}
  });
  const stopConnected = await listen("mail-connected", refreshMailbox).catch((error) => {
    stopEvents();
    throw error;
  });
  const onVisible = () => {
    if (document.visibilityState === "visible") refreshMailbox();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    stopEvents();
    stopConnected();
  };
}

async function beginMailEvents(version: number): Promise<void> {
  const nextUnlisten = await listenToMail();

  if (version !== lifecycleVersion) {
    nextUnlisten();
    return;
  }

  try {
    await callCommand("start_ws");
  } catch (error) {
    nextUnlisten();
    throw error;
  }

  if (version !== lifecycleVersion) {
    nextUnlisten();
    try {
      await callCommand("stop_ws");
    } catch {}
    return;
  }

  unlisten = nextUnlisten;
}

function clearStartOperation(operation: Promise<void>): void {
  if (startPromise === operation) startPromise = null;
}
