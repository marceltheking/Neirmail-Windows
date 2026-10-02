import { describe, expect, it } from "vitest";
import { parseMailto } from "./mailto";

describe("parseMailto", () => {
  it("reads the address, subject and body", () => {
    expect(parseMailto("mailto:ada@example.com?subject=Hello%20there&body=Line%201")).toEqual({
      kind: "new",
      to: "ada@example.com",
      cc: undefined,
      bcc: undefined,
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
});
