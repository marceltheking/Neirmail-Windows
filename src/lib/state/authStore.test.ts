import { describe, expect, it } from "vitest";
import { normalizeAccountKey } from "./authStore";

describe("normalizeAccountKey", () => {
  it("accepts the formatted key shown during signup", () => {
    expect(normalizeAccountKey("1HAE-X5GF-FDNO-VVYI")).toBe("1HAEX5GFFDNOVVYI");
  });

  it("accepts a legacy NEIR prefix and mixed separators", () => {
    expect(normalizeAccountKey("neir 1hae_x5gf-fdno vvyi")).toBe("1HAEX5GFFDNOVVYI");
  });
});
