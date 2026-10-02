import type { Folder, NavKind } from "../api/types";
import type { ListEmailsParams } from "../api/endpoints/emails";

export interface SystemNavItem {
  type: Exclude<NavKind, "folder">;
  name: string;
  icon: string;
}

export const SYSTEM_NAV: SystemNavItem[] = [
  { type: "inbox", name: "Inbox", icon: "fa-inbox" },
  { type: "starred", name: "Starred", icon: "fa-star" },
  { type: "sent", name: "Sent", icon: "fa-paper-plane" },
  { type: "drafts", name: "Drafts", icon: "fa-file-lines" },
  { type: "spam", name: "Spam", icon: "fa-shield-halved" },
  { type: "archive", name: "Archive", icon: "fa-box-archive" },
  { type: "trash", name: "Trash", icon: "fa-trash-can" },
];

export function folderByType(folders: Folder[], type: string): Folder | undefined {
  return folders.find((folder) => folder.type === type);
}

export function navListParams(
  nav: { kind: NavKind; folderId: string | null },
  folders: Folder[],
): ListEmailsParams {
  if (nav.kind === "starred") return { starred: true };
  if (nav.kind === "archive") return { archived: true };
  if (nav.kind === "folder") return { folderId: nav.folderId ?? undefined };
  const folder = folderByType(folders, nav.kind);
  return { folderId: folder?.id };
}

export function navQueryKey(nav: { kind: NavKind; folderId: string | null }): string {
  return nav.kind === "folder" ? `folder:${nav.folderId}` : nav.kind;
}

export function navBadgeCount(type: SystemNavItem["type"], folder: Folder | undefined): number {
  if (!folder) return 0;
  if (type === "inbox") return folder.unreadCount;
  if (type === "drafts" || type === "spam") return folder.totalCount;
  return 0;
}
