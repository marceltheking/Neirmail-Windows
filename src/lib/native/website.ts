import { openUrl } from "@tauri-apps/plugin-opener";
import { useToastStore } from "../state/toastStore";

export type WebsitePage = "signup" | "recovery" | "system" | "terms" | "privacy";

export function openWebsite(page: WebsitePage): void {
  void openUrl(`https://neir.io/${page}`).catch(() =>
    useToastStore.getState().show("Could not open your browser."),
  );
}
