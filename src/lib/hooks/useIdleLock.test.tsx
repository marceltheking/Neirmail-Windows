// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdleLock } from "./useIdleLock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function renderHook(callback: () => void) {
  function Probe() {
    callback();
    return null;
  }
  act(() => root.render(<Probe />));
}

describe("useIdleLock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it("locks after the configured idle time", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLock(5, onIdle));
    vi.advanceTimersByTime(4 * 60_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000 + 15_000);
    expect(onIdle).toHaveBeenCalled();
  });

  it("treats input as activity", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLock(5, onIdle));
    vi.advanceTimersByTime(4 * 60_000);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    vi.advanceTimersByTime(2 * 60_000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("does nothing when turned off", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLock(0, onIdle));
    vi.advanceTimersByTime(24 * 60 * 60_000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("locks after the computer wakes from sleep", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLock(5, onIdle));
    vi.setSystemTime(Date.now() + 60 * 60_000);
    vi.advanceTimersByTime(15_000);
    expect(onIdle).toHaveBeenCalled();
  });
});
