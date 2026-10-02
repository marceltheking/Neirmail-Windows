export type IconKind = "white" | "black" | "solid" | "dark" | "light" | "plain";

export interface IconLook {
  kind: IconKind;
  color?: string;
}

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function senderIconDomain(address: string | null | undefined): string {
  const raw = address ?? "";
  const inner = /<([^>]+)>/.exec(raw)?.[1] ?? raw.split(/[;,]/)[0];
  const at = inner.lastIndexOf("@");
  if (at < 0) return "";
  const domain = inner
    .slice(at + 1)
    .toLowerCase()
    .trim();
  return domain.length <= 253 && DOMAIN_PATTERN.test(domain) ? domain : "";
}

export function avatarText(name: string | null | undefined, address: string | null | undefined) {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter((part) => /[a-z0-9]/i.test(part));
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) {
    return (
      parts[0]
        .replace(/[^a-z0-9]/gi, "")
        .slice(0, 2)
        .toUpperCase() || "?"
    );
  }
  const local = (address ?? "").split("@")[0].replace(/[^a-z0-9]/gi, "");
  return local.slice(0, 2).toUpperCase() || "?";
}

function luma(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function classifyIconPixels(pixels: Uint8ClampedArray, size: number): IconLook {
  const at = (x: number, y: number) => (y * size + x) * 4;
  const probes = [at(3, 3), at(size - 4, 3), at(3, size - 4), at(size - 4, size - 4)];

  if (probes.every((index) => pixels[index + 3] > 235)) {
    const [r, g, b] = [pixels[probes[0]], pixels[probes[0] + 1], pixels[probes[0] + 2]];
    const uniform = probes.every(
      (index) =>
        Math.max(
          Math.abs(pixels[index] - r),
          Math.abs(pixels[index + 1] - g),
          Math.abs(pixels[index + 2] - b),
        ) <= 24,
    );
    if (uniform) {
      const background = luma(r, g, b);
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      if (saturation < 32 && background > 0.86) return { kind: "white" };
      if (saturation < 32 && background < 0.14) return { kind: "black" };
      return { kind: "solid", color: `rgb(${r}, ${g}, ${b})` };
    }
  }

  let sum = 0;
  let weight = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha > 0.3) {
      sum += alpha * luma(pixels[index], pixels[index + 1], pixels[index + 2]);
      weight += alpha;
    }
  }
  if (!weight) return { kind: "plain" };
  const mean = sum / weight;
  return { kind: mean < 0.3 ? "dark" : mean > 0.78 ? "light" : "plain" };
}

export function chunkDomains(domains: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < domains.length; index += size) {
    chunks.push(domains.slice(index, index + size));
  }
  return chunks;
}
