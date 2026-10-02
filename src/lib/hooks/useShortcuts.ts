import { useEffect, useLayoutEffect, useRef } from "react";

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

export function shortcutKey(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (event.shiftKey && event.key.length > 1) parts.push("shift");
  parts.push(key === " " ? "Space" : key);
  return parts.join("+");
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit"].includes(type);
}

function dialogOpen(): boolean {
  return Boolean(
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
    ),
  );
}

export function useShortcuts(
  map: ShortcutMap,
  options: { enabled?: boolean; global?: boolean } = {},
) {
  const mapRef = useRef(map);
  useLayoutEffect(() => {
    mapRef.current = map;
  });
  const { enabled = true, global = false } = options;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const key = shortcutKey(event);
      const handler = mapRef.current[key];
      if (!handler) return;
      const modified = key.startsWith("mod+");
      if (!modified && isTypingTarget(event.target)) return;
      if (!global && dialogOpen()) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, global]);
}
