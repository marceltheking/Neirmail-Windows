import type { QueryClient } from "@tanstack/react-query";
import type { EmailListResult } from "../api/types";

export function markListedAsRead(queryClient: QueryClient, emailId: string): boolean {
  let changed = false;
  queryClient.setQueriesData<EmailListResult>({ queryKey: ["emails"] }, (current) => {
    if (!current?.emails?.some((email) => email.id === emailId && !email.isRead)) return current;
    changed = true;
    return {
      ...current,
      emails: current.emails.map((email) =>
        email.id === emailId ? { ...email, isRead: true } : email,
      ),
    };
  });
  return changed;
}
