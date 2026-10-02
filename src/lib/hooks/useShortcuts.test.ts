// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isTypingTarget, shortcutKey } from "./useShortcuts";

function key(init: KeyboardEventInit) {
  return new KeyboardEvent("keydown", init);
}

describe("shortcuts", () => {
  it("normalises keys and modifiers", () => {
    expect(shortcutKey(key({ key: "R" }))).toBe("r");
    expect(shortcutKey(key({ key: "?", shiftKey: true }))).toBe("?");
    expect(shortcutKey(key({ key: "l", ctrlKey: true }))).toBe("mod+l");
    expect(shortcutKey(key({ key: "l", metaKey: true }))).toBe("mod+l");
    expect(shortcutKey(key({ key: "Escape" }))).toBe("Escape");
    expect(shortcutKey(key({ key: "Delete", shiftKey: true }))).toBe("shift+Delete");
  });

  it("treats text fields as typing targets but not checkboxes", () => {
    const text = document.createElement("input");
    const box = document.createElement("input");
    box.type = "checkbox";
    expect(isTypingTarget(text)).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(box)).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
  });
});
