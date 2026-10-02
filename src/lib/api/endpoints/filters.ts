import { apiRequest } from "../client";
import type { CreateFilterInput, EmailFilter } from "../types";

export async function listFilters(): Promise<EmailFilter[]> {
  const data = await apiRequest<{ filters: EmailFilter[] }>("GET", "/settings/filters");
  return data.filters;
}

export function createFilter(input: CreateFilterInput): Promise<EmailFilter> {
  return apiRequest("POST", "/settings/filters", { body: input });
}

export function deleteFilter(id: string): Promise<void> {
  return apiRequest("DELETE", `/settings/filters/${encodeURIComponent(id)}`);
}

export async function reorderFilters(orderedIds: string[]): Promise<EmailFilter[]> {
  const data = await apiRequest<{ filters: EmailFilter[] }>("PATCH", "/settings/filters/reorder", {
    body: { orderedIds },
  });
  return data.filters;
}

export async function previewFilter(
  input: Omit<CreateFilterInput, "action" | "destinationFolderId">,
): Promise<number> {
  const query: Record<string, string> = { field: input.field };
  if (input.matchType) query.matchType = input.matchType;
  if (input.matchValue) query.matchValue = input.matchValue;
  const data = await apiRequest<{ count: number }>("GET", "/settings/filters/preview", { query });
  return data.count;
}
