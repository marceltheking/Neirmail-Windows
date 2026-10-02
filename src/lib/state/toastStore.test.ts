import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStore } from "./toastStore";

describe("toast store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ active: null, last: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("labels ordinary messages as done and failures as failed", () => {
    useToastStore.getState().show("Preferences saved");
    expect(useToastStore.getState().active).toMatchObject({ kind: "ok", label: "Done" });
    useToastStore.getState().show("Could not save preferences.");
    expect(useToastStore.getState().active).toMatchObject({ kind: "error", label: "Failed" });
  });

  it("dismisses on its own, sooner without an action than with one", () => {
    useToastStore.getState().show("Saved");
    vi.advanceTimersByTime(2599);
    expect(useToastStore.getState().active).not.toBeNull();
    vi.advanceTimersByTime(2);
    expect(useToastStore.getState().active).toBeNull();

    useToastStore.getState().show("Archived", { label: "Undo", onClick: () => undefined });
    vi.advanceTimersByTime(4999);
    expect(useToastStore.getState().active).not.toBeNull();
    vi.advanceTimersByTime(2);
    expect(useToastStore.getState().active).toBeNull();
  });

  it("only dismisses the toast it was asked to, and a newer toast replaces an older timer", () => {
    const first = useToastStore.getState().show("First");
    const second = useToastStore.getState().show("Second");
    useToastStore.getState().dismiss(first);
    expect(useToastStore.getState().active?.id).toBe(second);
    vi.advanceTimersByTime(2601);
    expect(useToastStore.getState().active).toBeNull();
  });

  it("keeps the last toast around so it can slide out instead of vanishing", () => {
    useToastStore.getState().show("Saved");
    vi.advanceTimersByTime(3000);
    expect(useToastStore.getState().active).toBeNull();
    expect(useToastStore.getState().last?.message).toBe("Saved");
  });
});
