import DOMPurify from "dompurify";

const RICH_SELECTOR = "img,table,a[href],h1,h2,h3,h4,h5,h6,ul,ol,hr,blockquote,center,font,style";

const COMPOSE_SANITIZE = {
  FORCE_BODY: true,
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
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
  ],
  FORBID_ATTR: ["srcset", "poster", "data-neir-src"],
  ADD_ATTR: ["target"],
};

export const ORIGINAL_SOURCE_ATTRIBUTE = "data-neir-src";
const EDITOR_MARKER = "data-neir-compose";

export interface CleanedHtml {
  html: string;
  removedImages: number;
}

export interface ComposedHtml {
  html: string;
  text: string;
}

export function isRichHtml(html: string): boolean {
  if (!html.trim()) return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Boolean(doc.querySelector(RICH_SELECTOR));
}

export function hostedImageUrl(source: string): string | null {
  const value = source.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return null;
}

export function cleanComposeHtml(raw: string): CleanedHtml {
  const parsed = new DOMParser().parseFromString(raw, "text/html");
  const styles = Array.from(parsed.head.querySelectorAll("style"))
    .map((style) => style.outerHTML)
    .join("");
  let removedImages = 0;
  parsed.querySelectorAll("img").forEach((image) => {
    const source = image.getAttribute("src") ?? "";
    if (hostedImageUrl(source) || /^data:image\//i.test(source.trim())) return;
    image.remove();
    removedImages += 1;
  });
  return {
    html: DOMPurify.sanitize(styles + parsed.body.innerHTML, COMPOSE_SANITIZE),
    removedImages,
  };
}

export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/\r?\n/g, "<br>");
}

export function holdRemoteImages(root: ParentNode): HTMLImageElement[] {
  const held: HTMLImageElement[] = [];
  root.querySelectorAll("img").forEach((image) => {
    if (image.hasAttribute(ORIGINAL_SOURCE_ATTRIBUTE)) return;
    const remote = hostedImageUrl(image.getAttribute("src") ?? "");
    if (!remote) return;
    image.setAttribute(ORIGINAL_SOURCE_ATTRIBUTE, remote);
    image.removeAttribute("src");
    held.push(image);
  });
  return held;
}

export function prepareEditorHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  holdRemoteImages(template.content);
  return template.innerHTML;
}

export function wrapComposeDocument(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
html,body{margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;background:#fff;padding:14px;min-height:calc(100vh - 28px);word-wrap:break-word;overflow-wrap:anywhere;outline:none}
img{max-width:100%;height:auto}
</style>
</head><body ${EDITOR_MARKER}>${bodyHtml}</body></html>`;
}

export function isComposeDocument(doc: Document): boolean {
  return Boolean(doc.body?.hasAttribute(EDITOR_MARKER));
}

export function serializeComposeBody(body: HTMLElement): ComposedHtml {
  const copy = body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(`[${ORIGINAL_SOURCE_ATTRIBUTE}]`).forEach((image) => {
    image.setAttribute("src", image.getAttribute(ORIGINAL_SOURCE_ATTRIBUTE) ?? "");
    image.removeAttribute(ORIGINAL_SOURCE_ATTRIBUTE);
  });
  const text = (body.innerText || body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  return {
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${copy.innerHTML}</body></html>`,
    text,
  };
}

export function htmlDocumentBody(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.innerHTML;
}
