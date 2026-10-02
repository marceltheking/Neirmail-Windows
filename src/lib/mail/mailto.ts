import type { ComposeDefaults } from "../state/composeStore";

const MAX_SUBJECT_CHARS = 500;
const MAX_BODY_CHARS = 20_000;

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
      subject: (params.get("subject") ?? "").slice(0, MAX_SUBJECT_CHARS),
      body: (params.get("body") ?? "").slice(0, MAX_BODY_CHARS),
    };
  } catch {
    return null;
  }
}
