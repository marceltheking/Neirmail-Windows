import { describe, expect, it } from "vitest";
import { avatarText, chunkDomains, classifyIconPixels, senderIconDomain } from "./senderIcon";

function fill(size: number, paint: (x: number, y: number) => [number, number, number, number]) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      pixels.set(paint(x, y), (y * size + x) * 4);
    }
  }
  return pixels;
}

describe("senderIconDomain", () => {
  it("takes the lowercase domain of a plain or bracketed address", () => {
    expect(senderIconDomain("Mara@Studio.Example")).toBe("studio.example");
    expect(senderIconDomain("Mara <mara@studio.example>")).toBe("studio.example");
    expect(senderIconDomain("Doe, Mara <mara@studio.example>")).toBe("studio.example");
    expect(senderIconDomain("a@first.example, b@second.example")).toBe("first.example");
  });

  it("returns nothing for addresses that cannot have a public icon", () => {
    expect(senderIconDomain("")).toBe("");
    expect(senderIconDomain(null)).toBe("");
    expect(senderIconDomain("local@localhost")).toBe("");
    expect(senderIconDomain("a@b_c.example")).toBe("");
    expect(senderIconDomain("a@exa mple.com")).toBe("");
  });
});

describe("avatarText", () => {
  it("uses two initials from a name, or the start of one word or the address", () => {
    expect(avatarText("Mara Nilsson", "m@x.io")).toBe("MN");
    expect(avatarText("Neir", "hello@neir.io")).toBe("NE");
    expect(avatarText(null, "receipts@rail.example")).toBe("RE");
    expect(avatarText("", "")).toBe("?");
  });
});

describe("classifyIconPixels", () => {
  const size = 24;

  it("recognises a white tile and a black tile", () => {
    expect(
      classifyIconPixels(
        fill(size, () => [255, 255, 255, 255]),
        size,
      ).kind,
    ).toBe("white");
    expect(
      classifyIconPixels(
        fill(size, () => [0, 0, 0, 255]),
        size,
      ).kind,
    ).toBe("black");
  });

  it("keeps the colour of a solid brand tile", () => {
    const look = classifyIconPixels(
      fill(size, () => [200, 30, 40, 255]),
      size,
    );
    expect(look).toEqual({ kind: "solid", color: "rgb(200, 30, 40)" });
  });

  it("classifies transparent artwork by how light it is", () => {
    const transparent = (value: number) =>
      fill(size, (x, y) =>
        x > 8 && x < 16 && y > 8 && y < 16 ? [value, value, value, 255] : [0, 0, 0, 0],
      );
    expect(classifyIconPixels(transparent(10), size).kind).toBe("dark");
    expect(classifyIconPixels(transparent(250), size).kind).toBe("light");
    expect(classifyIconPixels(transparent(128), size).kind).toBe("plain");
    expect(
      classifyIconPixels(
        fill(size, () => [0, 0, 0, 0]),
        size,
      ).kind,
    ).toBe("plain");
  });
});

describe("chunkDomains", () => {
  it("splits requests below the server limit", () => {
    expect(chunkDomains(["a", "b", "c", "d", "e"], 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(chunkDomains([], 2)).toEqual([]);
  });
});
