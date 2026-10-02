import { apiRequest } from "../client";
import type { MailboxAddress } from "../types";

export async function listAddresses(): Promise<MailboxAddress[]> {
  const data = await apiRequest<{ addresses: MailboxAddress[] }>("GET", "/email/addresses");
  return data.addresses;
}

export function createAddress(username: string, domain: string): Promise<MailboxAddress> {
  return apiRequest("POST", "/email/addresses", { body: { username, domain } });
}

export function createRandomAddress(): Promise<MailboxAddress> {
  return apiRequest("POST", "/email/addresses/random");
}

export function updatePrimaryAddress(
  id: string,
  username: string,
  domain: string,
): Promise<MailboxAddress> {
  return apiRequest("PATCH", `/email/addresses/${encodeURIComponent(id)}`, {
    body: { username, domain },
  });
}

export function deleteAddress(id: string): Promise<void> {
  return apiRequest("DELETE", `/email/addresses/${encodeURIComponent(id)}`);
}
