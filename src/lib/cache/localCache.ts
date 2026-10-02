import { callCommand } from "../api/client";
import type { EmailDetail, EmailListItem, Folder } from "../api/types";

export async function getCachedFolders(): Promise<Folder[]> {
  try {
    return await callCommand<Folder[]>("cache_get_folders");
  } catch {
    return [];
  }
}

export async function setCachedFolders(folders: Folder[]): Promise<void> {
  try {
    await callCommand("cache_set_folders", { folders });
  } catch {}
}

export async function getCachedEmailList(navKey: string): Promise<EmailListItem[]> {
  try {
    return await callCommand<EmailListItem[]>("cache_get_email_list", { navKey });
  } catch {
    return [];
  }
}

export async function setCachedEmailList(navKey: string, items: EmailListItem[]): Promise<void> {
  try {
    await callCommand("cache_set_email_list", { navKey, items });
  } catch {}
}

export async function getCachedEmailDetail(id: string): Promise<EmailDetail | null> {
  try {
    return await callCommand<EmailDetail | null>("cache_get_email_detail", { id });
  } catch {
    return null;
  }
}

export async function setCachedEmailDetail(id: string, detail: EmailDetail): Promise<void> {
  try {
    await callCommand("cache_set_email_detail", { id, detail });
  } catch {}
}

export async function forgetCachedEmails(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await callCommand("cache_forget_email_details", { ids });
  } catch {}
}

export function clearLocalCache(): Promise<void> {
  return callCommand<void>("clear_cache");
}
