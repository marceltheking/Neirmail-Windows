import { apiRequest, callCommand } from "../client";
import type { SenderIconSource } from "../types";

export async function getSenderIconSources(
  domains: string[],
): Promise<Record<string, SenderIconSource>> {
  const data = await apiRequest<{ icons?: Record<string, SenderIconSource> }>(
    "GET",
    "/webmail/sender-icons",
    { query: { domains: domains.join(",") } },
  );
  return data?.icons ?? {};
}

export function fetchSenderIcon(domain: string): Promise<string> {
  return callCommand<string>("fetch_sender_icon", { domain });
}
