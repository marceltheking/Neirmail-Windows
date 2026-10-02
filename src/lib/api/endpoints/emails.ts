import { apiRequest } from "../client";
import {
  ApiError,
  type BatchActionResult,
  type BatchActionType,
  type EmailDetail,
  type EmailListResult,
} from "../types";
import {
  forgetCachedEmails,
  getCachedEmailDetail,
  getCachedEmailList,
  setCachedEmailDetail,
  setCachedEmailList,
} from "../../cache/localCache";

export interface ListEmailsParams {
  folderId?: string;
  starred?: boolean;
  archived?: boolean;
  q?: string;
  sort?: "date_desc" | "date_asc" | "subject_asc";
  page?: number;
  limit?: number;
}

export async function listEmails(params: ListEmailsParams): Promise<EmailListResult> {
  const query: Record<string, string> = {};
  if (params.folderId) query.folderId = params.folderId;
  if (params.starred) query.starred = "true";
  if (params.archived) query.archived = "true";
  if (params.q) query.q = params.q;
  if (params.sort) query.sort = params.sort;
  query.page = String(params.page ?? 1);
  query.limit = String(params.limit ?? 20);

  const cacheKey = JSON.stringify(query);
  try {
    const result = await apiRequest<EmailListResult>("GET", "/webmail/emails", { query });
    setCachedEmailList(cacheKey, result.emails);
    return result;
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      const cached = await getCachedEmailList(cacheKey);
      if (cached.length > 0) {
        return { emails: cached, total: cached.length, page: 1, limit: cached.length };
      }
    }
    throw err;
  }
}

export async function getEmail(id: string): Promise<EmailDetail> {
  try {
    const detail = await apiRequest<EmailDetail>("GET", `/webmail/emails/${id}`);
    setCachedEmailDetail(id, detail);
    return detail;
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      const cached = await getCachedEmailDetail(id);
      if (cached) return cached;
    }
    if (err instanceof ApiError && err.status === 404) void forgetCachedEmails([id]);
    throw err;
  }
}

export function batchAction(
  ids: string[],
  action: BatchActionType,
  destinationFolderId?: string,
): Promise<BatchActionResult[]> {
  return apiRequest<{ results: BatchActionResult[] }>("POST", "/webmail/emails/batch", {
    body: { ids, action, destinationFolderId },
  }).then((result) => result.results);
}

export function unsubscribe(id: string): Promise<void> {
  return apiRequest<void>("POST", `/webmail/emails/${id}/unsubscribe`);
}

export function unscheduleSend(id: string): Promise<void> {
  return apiRequest<void>("POST", `/webmail/emails/${id}/unschedule`);
}
