import DOMPurify from "dompurify";

export const EMAIL_FRAME_SANDBOX = "allow-same-origin";
export const MAX_EMAIL_FRAME_HEIGHT = 60000;

const FORBIDDEN_TAGS = [
  "base",
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
];

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: ["srcset", "background", "poster", "ping", "data-neir-src"],
    ADD_ATTR: ["target"],
  });
}

export function wrapEmailDocument(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="color-scheme" content="light">
<base target="_blank">
<style>
html,body{margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.65;color:#1a1a1a;background:#fff;padding:14px;word-wrap:break-word;overflow-wrap:anywhere}
img{max-width:100%;height:auto}
a{color:#2f6b41}
table{max-width:100%}
blockquote{margin:14px 0;padding-left:14px;border-left:2px solid #d8d8d8;color:#555}
</style>
</head><body>${bodyHtml}</body></html>`;
}

export function remoteImageUrl(source: string): string | null {
  const value = source.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return null;
}

export function blockRemoteImages(doc: Document): boolean {
  let blocked = false;
  doc.querySelectorAll("img[src]").forEach((image) => {
    const source = image.getAttribute("src") ?? "";
    if (/^data:image\//i.test(source.trim())) return;
    const remote = remoteImageUrl(source);
    image.removeAttribute("src");
    if (remote) {
      image.setAttribute("data-neir-src", remote);
      blocked = true;
    }
  });
  return blocked;
}
