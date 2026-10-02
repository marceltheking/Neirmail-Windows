const TRACKING_KEYS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "msclkid",
  "vero_conv",
  "vero_id",
]);

export function stripTrackingParameters(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return value;

    for (const key of Array.from(url.searchParams.keys())) {
      const normalized = key.toLowerCase();
      if (normalized.startsWith("utm_") || TRACKING_KEYS.has(normalized)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}
