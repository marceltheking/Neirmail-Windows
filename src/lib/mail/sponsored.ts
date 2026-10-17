import { openUrl } from "@tauri-apps/plugin-opener";
import type { EmailListItem } from "../api/types";

export function sponsoredHost(email: Pick<EmailListItem, "isPinned" | "linkUrl">): string | null {
  if (!email.isPinned || !email.linkUrl) return null;
  try {
    const url = new URL(email.linkUrl);
    if (url.protocol !== "https:") return null;
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function openSponsoredLink(email: Pick<EmailListItem, "isPinned" | "linkUrl">): boolean {
  if (!sponsoredHost(email)) return false;
  void openUrl(email.linkUrl as string).catch(() => undefined);
  return true;
}
