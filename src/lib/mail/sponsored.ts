import { openUrl } from "@tauri-apps/plugin-opener";
import type { EmailListItem } from "../api/types";
import sageswapMark from "../../assets/sponsors/sageswap-mark.png";

const SPONSOR_MARKS: Record<string, string> = { "sageswap.io": sageswapMark };

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

export function sponsorMark(host: string | null): string | null {
  return host ? (SPONSOR_MARKS[host] ?? null) : null;
}
