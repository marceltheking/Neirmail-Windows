import type { ComposeDefaults } from "../state/composeStore";

export function parseMailto(href: string): ComposeDefaults | null {
  if (!/^mailto:/i.test(href)) return null;
  try {
    const url = new URL(href);
    const params = url.searchParams;
    const to = decodeURIComponent(url.pathname)
      .split(",")
      .map((address) => address.trim())
      .filter(Boolean);
    const cc = [...to.slice(1), params.get("cc") ?? ""].filter(Boolean).join(", ");
    return {
      kind: "new",
      to: to[0] ?? "",
      cc: cc || undefined,
      bcc: params.get("bcc") || undefined,
      subject: params.get("subject") ?? "",
      body: params.get("body") ?? "",
    };
  } catch {
    return null;
  }
}
