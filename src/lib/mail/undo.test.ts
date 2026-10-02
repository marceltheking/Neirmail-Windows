import { describe, expect, it } from "vitest";
import { planUndo } from "./undo";
import type { BatchActionResult } from "../api/types";

function result(id: string, previous: Partial<BatchActionResult["previous"]> = {}) {
  return {
    id,
    previous: {
      folderId: "inbox",
      isRead: false,
      isStarred: false,
      isArchived: false,
      ...previous,
    },
  } satisfies BatchActionResult;
}

describe("planUndo", () => {
  it("restores many messages with a handful of requests instead of three each", () => {
    const steps = planUndo(Array.from({ length: 25 }, (_, index) => result(`m${index}`)));
    expect(steps).toHaveLength(4);
    expect(steps[0]).toEqual({
      ids: Array.from({ length: 25 }, (_, index) => `m${index}`),
      action: "move",
      destinationFolderId: "inbox",
    });
  });

  it("puts each message back into its own previous state", () => {
    const steps = planUndo([
      result("a", { isRead: true, isStarred: true }),
      result("b", { folderId: "receipts", isArchived: true }),
    ]);
    const idsFor = (action: string, folder?: string) =>
      steps.find((step) => step.action === action && step.destinationFolderId === folder)?.ids;

    expect(idsFor("move", "inbox")).toEqual(["a"]);
    expect(idsFor("move", "receipts")).toEqual(["b"]);
    expect(idsFor("read")).toEqual(["a"]);
    expect(idsFor("unread")).toEqual(["b"]);
    expect(idsFor("star")).toEqual(["a"]);
    expect(idsFor("unstar")).toEqual(["b"]);
    expect(idsFor("archive")).toEqual(["b"]);
    expect(idsFor("unarchive")).toEqual(["a"]);
  });

  it("does nothing for an empty result", () => {
    expect(planUndo([])).toEqual([]);
  });
});
