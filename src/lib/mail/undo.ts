import { batchAction } from "../api/endpoints/emails";
import type { BatchActionResult, BatchActionType } from "../api/types";

export interface UndoStep {
  ids: string[];
  action: BatchActionType;
  destinationFolderId?: string;
}

export function planUndo(results: BatchActionResult[]): UndoStep[] {
  const steps: UndoStep[] = [];
  const byFolder = new Map<string, string[]>();
  const flags: Record<"read" | "unread" | "star" | "unstar" | "archive" | "unarchive", string[]> = {
    read: [],
    unread: [],
    star: [],
    unstar: [],
    archive: [],
    unarchive: [],
  };

  for (const { id, previous } of results) {
    const inFolder = byFolder.get(previous.folderId) ?? [];
    inFolder.push(id);
    byFolder.set(previous.folderId, inFolder);
    flags[previous.isRead ? "read" : "unread"].push(id);
    flags[previous.isStarred ? "star" : "unstar"].push(id);
    flags[previous.isArchived ? "archive" : "unarchive"].push(id);
  }

  for (const [destinationFolderId, ids] of byFolder) {
    steps.push({ ids, action: "move", destinationFolderId });
  }
  for (const [action, ids] of Object.entries(flags)) {
    if (ids.length > 0) steps.push({ ids, action: action as BatchActionType });
  }
  return steps;
}

export function buildUndo(results: BatchActionResult[]): () => Promise<void> {
  return async () => {
    const outcomes = await Promise.allSettled(
      planUndo(results).map((step) => batchAction(step.ids, step.action, step.destinationFolderId)),
    );
    const failed = outcomes.find((outcome) => outcome.status === "rejected");
    if (failed) throw failed.reason;
  };
}
