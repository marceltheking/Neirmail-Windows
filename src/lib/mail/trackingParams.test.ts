import { describe, expect, it } from "vitest";
import { stripTrackingParameters } from "./trackingParams";

describe("stripTrackingParameters", () => {
  it("removes known campaign identifiers without touching functional parameters", () => {
    expect(
      stripTrackingParameters(
        "https://example.com/read?id=42&utm_source=newsletter&fbclid=secret#message",
      ),
    ).toBe("https://example.com/read?id=42#message");
  });

  it("leaves unsupported and malformed URLs unchanged", () => {
    expect(stripTrackingParameters("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(stripTrackingParameters("not a url")).toBe("not a url");
  });
});
