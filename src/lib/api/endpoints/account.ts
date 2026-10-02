import { apiRequest, callCommand } from "../client";
import type { AccountActivity, AccountSummary } from "../types";

export function getAccountSummary(): Promise<AccountSummary> {
  return apiRequest<AccountSummary>("GET", "/account/summary");
}

export function getAccountActivity(): Promise<AccountActivity[]> {
  return apiRequest<{ activity: AccountActivity[] }>("GET", "/account/activity").then(
    (result) => result.activity,
  );
}

export function downloadAccountExport(): Promise<string> {
  return callCommand<string>("download_account_export");
}

export function deleteAccount(accountKey: string): Promise<void> {
  return apiRequest<void>("DELETE", "/account", { body: { accountKey } });
}
