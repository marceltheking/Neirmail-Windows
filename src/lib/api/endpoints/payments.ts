import { apiRequest } from "../client";
import type { PaymentCheckout, PaymentOptionsResult } from "../types";

export function getPaymentOptions(): Promise<PaymentOptionsResult> {
  return apiRequest<PaymentOptionsResult>("GET", "/payments/options");
}

export function createSubscriptionCheckout(
  months: 1 | 3 | 6 | 12,
  payCurrency: string,
  network: string,
): Promise<PaymentCheckout> {
  return apiRequest<PaymentCheckout>("POST", "/payments/subscription/checkout", {
    body: { months, payCurrency, network },
  });
}

export function getCheckoutStatus(id: string, token: string): Promise<PaymentCheckout> {
  return apiRequest<Omit<PaymentCheckout, "token">>("POST", `/payments/checkout/${id}/status`, {
    body: { token },
  }).then((result) => ({ ...result, token }));
}
