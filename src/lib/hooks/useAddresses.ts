import { useQuery } from "@tanstack/react-query";
import { listAddresses } from "../api/endpoints/dashboard";
import type { MailboxAddress } from "../api/types";

export function useAddresses(): MailboxAddress[] {
  const { data } = useQuery({ queryKey: ["addresses"], queryFn: listAddresses, staleTime: 60_000 });
  return data ?? [];
}

export function primaryAddress(addresses: MailboxAddress[]): MailboxAddress | undefined {
  return addresses.find((address) => address.type === "primary") ?? addresses[0];
}
