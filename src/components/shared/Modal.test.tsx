// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

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

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

describe("Modal", () => {
  it("closes on the first Escape press instead of dismissing a tooltip first", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal title="Confirm" onClose={onClose}>
          <button type="button">Confirm</button>
        </Modal>,
      );
    });

    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    await act(async () => {
      pressEscape();
      vi.advanceTimersByTime(300);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores pointer events on the page once it has closed", async () => {
    const onClose = vi.fn(() => root.render(null));
    await act(async () => {
      root.render(
        <Modal title="Confirm" onClose={onClose}>
          <button type="button">Confirm</button>
        </Modal>,
      );
    });
    expect(document.body.style.pointerEvents).toBe("none");

    await act(async () => {
      pressEscape();
      vi.advanceTimersByTime(300);
    });

    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("stays open while an action is in flight", async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal title="Working" onClose={onClose} preventClose>
          <p>Please wait</p>
        </Modal>,
      );
    });

    await act(async () => {
      pressEscape();
      vi.advanceTimersByTime(300);
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
