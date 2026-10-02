// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  EMAIL_FRAME_SANDBOX,
  blockRemoteImages,
  remoteImageUrl,
  sanitizeEmailHtml,
} from "./emailHtmlSanitizer";

describe("sanitizeEmailHtml", () => {
  it("strips <script> tags entirely", () => {
    const out = sanitizeEmailHtml("<p>hi</p><script>alert(document.cookie)</script>");
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain("<p>hi</p>");
  });

  it("strips inline event-handler attributes", () => {
    const out = sanitizeEmailHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toMatch(/onerror/i);
  });

  it("strips javascript: hrefs", () => {
    const out = sanitizeEmailHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it("strips iframe/object/embed/form/link/meta/base, even nested", () => {
    const out = sanitizeEmailHtml(
      '<div><iframe src="https://evil.example"></iframe>' +
        '<object data="x"></object><embed src="x">' +
        '<form action="https://evil.example"><input></form>' +
        '<link rel="stylesheet" href="https://evil.example/x.css">' +
        '<meta http-equiv="refresh" content="0;url=https://evil.example">' +
        '<base href="https://evil.example/"></div>',
    );
    for (const tag of ["iframe", "object", "embed", "form", "input", "link", "meta", "base"]) {
      expect(out.toLowerCase()).not.toContain(`<${tag}`);
    }
  });

  it("strips srcset/background/poster, which can trigger a fetch DOMPurify's tag/attr allowlist alone would not catch", () => {
    const out = sanitizeEmailHtml(
      '<img src="x" srcset="https://evil.example/track.png 1x">' +
        '<table background="https://evil.example/track.png"></table>' +
        '<video poster="https://evil.example/track.png"></video>',
    );
    expect(out).not.toMatch(/srcset=/i);
    expect(out).not.toMatch(/background=/i);
    expect(out).not.toMatch(/poster=/i);
  });

  it("keeps ordinary formatting and inline styling intact", () => {
    const out = sanitizeEmailHtml('<p style="font-weight:bold">Hello <strong>world</strong></p>');
    expect(out).toContain('style="font-weight:bold"');
    expect(out).toContain("<strong>world</strong>");
  });

  it("is not defeated by mutation-style nesting inside an SVG/foreignObject", () => {
    const out = sanitizeEmailHtml(
      "<svg><foreignObject><script>alert(1)</script></foreignObject></svg>",
    );
    expect(out).not.toMatch(/<script/i);
  });
});

describe("blockRemoteImages", () => {
  it("removes the src of an http(s) image and stashes it on a data attribute", () => {
    document.body.innerHTML = '<img id="pic" src="https://example.com/pixel.gif">';
    const blocked = blockRemoteImages(document);
    const img = document.getElementById("pic") as HTMLImageElement;
    expect(blocked).toBe(true);
    expect(img.getAttribute("src")).toBeNull();
    expect(img.getAttribute("data-neir-src")).toBe("https://example.com/pixel.gif");
  });

  it("keeps data: images and drops relative or odd sources without offering to load them", () => {
    document.body.innerHTML =
      '<img id="a" src="data:image/png;base64,AAAA"><img id="b" src="/local.png"><img id="c" src="cid:logo">';
    const blocked = blockRemoteImages(document);
    expect(blocked).toBe(false);
    expect((document.getElementById("a") as HTMLImageElement).getAttribute("src")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(document.getElementById("b")?.getAttribute("src")).toBeNull();
    expect(document.getElementById("c")?.getAttribute("src")).toBeNull();
  });

  it("treats protocol-relative images as remote", () => {
    document.body.innerHTML = '<img id="pic" src="//tracker.example/pixel.gif">';
    expect(blockRemoteImages(document)).toBe(true);
    const img = document.getElementById("pic") as HTMLImageElement;
    expect(img.getAttribute("src")).toBeNull();
    expect(img.getAttribute("data-neir-src")).toBe("https://tracker.example/pixel.gif");
  });
});

describe("remoteImageUrl", () => {
  it("only accepts web addresses", () => {
    expect(remoteImageUrl(" HTTP://a.example/x.png ")).toBe("HTTP://a.example/x.png");
    expect(remoteImageUrl("//a.example/x.png")).toBe("https://a.example/x.png");
    expect(remoteImageUrl("javascript:alert(1)")).toBeNull();
    expect(remoteImageUrl("file:///etc/passwd")).toBeNull();
    expect(remoteImageUrl("data:image/png;base64,AAAA")).toBeNull();
  });
});

describe("email frame hardening", () => {
  it("grants the frame no scripts, popups, forms or navigation", () => {
    const flags = EMAIL_FRAME_SANDBOX.split(/\s+/);
    expect(flags).toEqual(["allow-same-origin"]);
  });

  it("drops tracking and internal attributes an email should never control", () => {
    const out = sanitizeEmailHtml(
      '<a href="https://x.example" ping="https://t.example/p">x</a><img src="data:image/png;base64,AAAA" data-neir-src="https://t.example/i.gif">',
    );
    expect(out).not.toMatch(/ping=/i);
    expect(out).not.toMatch(/data-neir-src/i);
  });
});
