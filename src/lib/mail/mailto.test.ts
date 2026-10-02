import { describe, expect, it } from "vitest";
import { parseMailto } from "./mailto";

describe("parseMailto", () => {
  it("reads the address, subject and body", () => {
    expect(parseMailto("mailto:ada@example.com?subject=Hello%20there&body=Line%201")).toEqual({
      kind: "new",
      to: "ada@example.com",
      cc: undefined,
      subject: "Hello there",
      body: "Line 1",
    });
  });

  it("keeps one To recipient and moves the rest to Cc", () => {
    expect(parseMailto("mailto:a@x.io,b@x.io?cc=c@x.io")).toMatchObject({
      to: "a@x.io",
      cc: "b@x.io, c@x.io",
    });
  });

  it("ignores anything that is not a mailto link", () => {
    expect(parseMailto("https://example.com")).toBeNull();
  });

  it("never adds hidden Bcc recipients from a link in an email", () => {
    const parsed = parseMailto("mailto:boss@x.io?bcc=spy@evil.example&subject=Hi");
    expect(parsed).not.toHaveProperty("bcc");
    expect(JSON.stringify(parsed)).not.toContain("spy@evil.example");
  });
});
