import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushOutgoing, outgoingCount, queueOutgoing } from "./outbox";

function options(overrides: Partial<Parameters<typeof queueOutgoing>[0]> = {}) {
  return {
    delayMs: 5000,
    deliver: vi.fn().mockResolvedValue(undefined),
    keep: vi.fn().mockResolvedValue(undefined),
    onSent: vi.fn(),
    onFailed: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.useFakeTimers());

afterEach(async () => {
  await flushOutgoing();
  vi.useRealTimers();
});

describe("outbox", () => {
  it("delivers after the undo window", async () => {
    const message = options();
    queueOutgoing(message);
    expect(outgoingCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(message.deliver).toHaveBeenCalledTimes(1);
    expect(message.onSent).toHaveBeenCalledTimes(1);
    expect(outgoingCount()).toBe(0);
  });

  it("does not deliver a message that was undone", async () => {
    const message = options();
    const cancel = queueOutgoing(message);
    cancel();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(message.deliver).not.toHaveBeenCalled();
    expect(outgoingCount()).toBe(0);
  });

  it("reports a failed delivery", async () => {
    const cause = new Error("offline");
    const message = options({ deliver: vi.fn().mockRejectedValue(cause) });
    queueOutgoing(message);
    await vi.advanceTimersByTimeAsync(5000);
    expect(message.onFailed).toHaveBeenCalledWith(cause);
    expect(message.onSent).not.toHaveBeenCalled();
  });

  it("sends everything waiting immediately when the app is closing", async () => {
    const first = options();
    const second = options();
    queueOutgoing(first);
    queueOutgoing(second);
    await flushOutgoing();
    expect(first.deliver).toHaveBeenCalledTimes(1);
    expect(second.deliver).toHaveBeenCalledTimes(1);
    expect(outgoingCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(first.deliver).toHaveBeenCalledTimes(1);
  });

  it("keeps the message as a draft when the closing delivery fails", async () => {
    const message = options({ deliver: vi.fn().mockRejectedValue(new Error("offline")) });
    queueOutgoing(message);
    await flushOutgoing();
    expect(message.keep).toHaveBeenCalledTimes(1);
  });

  it("counts and waits for a message that is already uploading", async () => {
    let finish: () => void = () => undefined;
    const message = options({
      deliver: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))),
    });
    queueOutgoing(message);
    await vi.advanceTimersByTimeAsync(5000);
    expect(outgoingCount()).toBe(1);
    let flushed = false;
    const flushing = flushOutgoing().then(() => (flushed = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(flushed).toBe(false);
    finish();
    await flushing;
    expect(outgoingCount()).toBe(0);
    expect(message.onSent).toHaveBeenCalledTimes(1);
  });
});
