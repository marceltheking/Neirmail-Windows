import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clear = vi.hoisted(() => vi.fn());
vi.mock("../api/endpoints/attachments", () => ({ clearStagedAttachments: clear }));

import { useComposeStore } from "../state/composeStore";
import { flushOutgoing, queueOutgoing } from "./outbox";
import { releaseStagedAttachments } from "./staging";

beforeEach(() => {
  vi.useFakeTimers();
  clear.mockReset().mockResolvedValue(undefined);
  useComposeStore.getState().close();
});

afterEach(async () => {
  await flushOutgoing();
  vi.useRealTimers();
});

describe("releaseStagedAttachments", () => {
  it("removes decrypted copies once nothing can still send them", async () => {
    releaseStagedAttachments();
    await vi.advanceTimersByTimeAsync(0);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("keeps them while a message is waiting in the undo window or compose is open", async () => {
    queueOutgoing({
      delayMs: 5000,
      deliver: vi.fn().mockResolvedValue(undefined),
      keep: vi.fn(),
      onSent: vi.fn(),
      onFailed: vi.fn(),
    });
    releaseStagedAttachments();
    await vi.advanceTimersByTimeAsync(0);
    useComposeStore.getState().open({});
    await flushOutgoing();
    releaseStagedAttachments();
    await vi.advanceTimersByTimeAsync(0);
    expect(clear).not.toHaveBeenCalled();
  });
});
