import { apiRequest } from "../client";
import type { Contact } from "../types";

export async function listContacts(): Promise<Contact[]> {
  const data = await apiRequest<{ contacts: Contact[] }>("GET", "/settings/contacts");
  return data.contacts;
}

export function createContact(displayName: string, email: string): Promise<Contact> {
  return apiRequest("POST", "/settings/contacts", { body: { displayName, email } });
}

export function setContactPgpKey(email: string, pgpPublicKey: string): Promise<Contact> {
  return apiRequest("POST", "/settings/contacts/pgp-key", { body: { email, pgpPublicKey } });
}

export function deleteContact(id: string): Promise<void> {
  return apiRequest("DELETE", `/settings/contacts/${encodeURIComponent(id)}`);
}
