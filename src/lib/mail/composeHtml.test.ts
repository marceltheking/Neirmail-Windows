// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  cleanComposeHtml,
  holdRemoteImages,
  isRichHtml,
  plainTextToHtml,
  prepareEditorHtml,
  serializeComposeBody,
} from "./composeHtml";

const MARKETING = `<html><head><style>.btn{color:#fff}</style></head><body>
<table><tr><td><img src="https://cdn.example/logo.png" alt="Logo">
<h1>Autumn sale</h1><p><a class="btn" href="https://shop.example">Shop now</a></p>
<img src="images/local.png"><script>alert(1)</script>
<button onclick="steal()">x</button></td></tr></table></body></html>`;

describe("isRichHtml", () => {
  it("recognises a designed email copied from a browser", () => {
    expect(isRichHtml(MARKETING)).toBe(true);
  });

  it("leaves ordinary copied text as plain text", () => {
    expect(isRichHtml("<meta charset='utf-8'><span>Just a sentence</span>")).toBe(false);
    expect(isRichHtml("")).toBe(false);
  });
});

describe("cleanComposeHtml", () => {
  it("keeps layout, hosted images, links and styles but strips anything active", () => {
    const { html, removedImages } = cleanComposeHtml(MARKETING);
    expect(html).toContain("<table>");
    expect(html).toContain('src="https://cdn.example/logo.png"');
    expect(html).toContain('href="https://shop.example"');
    expect(html).toContain(".btn{color:#fff}");
    expect(html).not.toMatch(/<script|onclick|<button/i);
    expect(html).not.toContain("images/local.png");
    expect(removedImages).toBe(1);
  });
});

describe("editor round trip", () => {
  it("holds remote images out of the editor and restores them when sending", () => {
    const prepared = prepareEditorHtml('<p>Hi</p><img src="https://cdn.example/a.png">');
    expect(prepared).not.toMatch(/\ssrc="https:\/\/cdn\.example\/a\.png"/);
    expect(prepared).toContain('data-neir-src="https://cdn.example/a.png"');

    const body = document.createElement("body");
    body.innerHTML = prepared;
    body.querySelector("img")!.setAttribute("src", "data:image/png;base64,AAAA");
    const composed = serializeComposeBody(body);
    expect(composed.html).toContain('src="https://cdn.example/a.png"');
    expect(composed.html).not.toContain("data:image/png");
    expect(composed.html).not.toContain("data-neir-src");
    expect(composed.html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(composed.text).toBe("Hi");
  });

  it("only holds each image once", () => {
    const root = document.createElement("div");
    root.innerHTML = '<img src="//cdn.example/b.png">';
    expect(holdRemoteImages(root)).toHaveLength(1);
    expect(holdRemoteImages(root)).toHaveLength(0);
    expect(root.querySelector("img")!.getAttribute("data-neir-src")).toBe(
      "https://cdn.example/b.png",
    );
  });
});

describe("plainTextToHtml", () => {
  it("escapes markup and keeps line breaks", () => {
    expect(plainTextToHtml('a <b> & "c"\nnext')).toBe("a &lt;b&gt; &amp; &quot;c&quot;<br>next");
  });
});
