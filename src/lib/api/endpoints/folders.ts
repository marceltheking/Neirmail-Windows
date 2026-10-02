import { apiRequest } from "../client";
import { ApiError, type Folder } from "../types";
import { getCachedFolders, setCachedFolders } from "../../cache/localCache";

export async function listFolders(): Promise<Folder[]> {
  try {
    const result = await apiRequest<{ folders: Folder[] }>("GET", "/webmail/folders");
    setCachedFolders(result.folders);
    return result.folders;
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      const cached = await getCachedFolders();
      if (cached.length > 0) return cached;
    }
    throw err;
  }
}

export function createFolder(name: string, iconClass?: string): Promise<Folder> {
  return apiRequest<Folder>("POST", "/webmail/folders", { body: { name, iconClass } });
}

export function deleteFolder(id: string): Promise<void> {
  return apiRequest<void>("DELETE", `/webmail/folders/${id}`);
}

export function emptyFolder(id: string): Promise<void> {
  return apiRequest<void>("POST", `/webmail/folders/${id}/empty`);
}
