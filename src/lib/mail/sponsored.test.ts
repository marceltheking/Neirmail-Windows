import { describe, expect, it, vi } from "vitest";

const openUrl = vi.fn(() => Promise.resolve());
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));

const { openSponsoredLink, sponsorMark, sponsoredHost } = await import("./sponsored");

describe("sponsoredHost", () => {
  it("returns the bare hostname of a pinned https link", () => {
    expect(sponsoredHost({ isPinned: true, linkUrl: "https://www.sageswap.io/path" })).toBe(
      "sageswap.io",
    );
  });

  it("ignores unpinned mail, missing links and non-https links", () => {
    expect(sponsoredHost({ isPinned: false, linkUrl: "https://sageswap.io/" })).toBeNull();
    expect(sponsoredHost({ isPinned: true, linkUrl: null })).toBeNull();
    expect(sponsoredHost({ isPinned: true })).toBeNull();
    expect(sponsoredHost({ isPinned: true, linkUrl: "http://sageswap.io/" })).toBeNull();
    expect(sponsoredHost({ isPinned: true, linkUrl: "javascript:alert(1)" })).toBeNull();
    expect(sponsoredHost({ isPinned: true, linkUrl: "not a url" })).toBeNull();
  });
});

describe("openSponsoredLink", () => {
  it("opens only valid sponsored links in the system browser", () => {
    expect(openSponsoredLink({ isPinned: true, linkUrl: "https://sageswap.io/" })).toBe(true);
    expect(openUrl).toHaveBeenCalledWith("https://sageswap.io/");
    openUrl.mockClear();
    expect(openSponsoredLink({ isPinned: true, linkUrl: "http://sageswap.io/" })).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });
});

describe("sponsorMark", () => {
  it("returns the bundled logo for a known sponsor only", () => {
    expect(sponsorMark("sageswap.io")).toMatch(/sageswap-mark/);
    expect(sponsorMark("example.com")).toBeNull();
    expect(sponsorMark(null)).toBeNull();
  });
});
