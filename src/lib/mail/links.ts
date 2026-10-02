import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Preferences } from "../api/types";
import { queryClient } from "../queryClient";
import { useComposeStore } from "../state/composeStore";
import { useToastStore } from "../state/toastStore";
import { parseMailto } from "./mailto";
import { stripTrackingParameters } from "./trackingParams";

export const BLOCKED_WINDOW_EVENT = "blocked-window-request";

export function openEmailLink(href: string): void {
  const value = href.trim();
  const mailto = parseMailto(value);
  if (mailto) {
    useComposeStore.getState().open(mailto);
    return;
  }
  if (!/^https?:\/\//i.test(value)) return;
  const preferences = queryClient.getQueryData<Preferences>(["preferences"]);
  const target =
    preferences?.stripTrackingParamsEnabled !== false ? stripTrackingParameters(value) : value;
  void openUrl(target).catch(() => useToastStore.getState().show("Could not open that link."));
}

export function listenForBlockedWindows(): Promise<UnlistenFn> {
  return listen<string>(BLOCKED_WINDOW_EVENT, (event) => {
    if (typeof event.payload === "string") openEmailLink(event.payload);
  });
}
