import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { markListedAsRead } from "./readState";
import type { EmailListResult } from "../api/types";

function list(): EmailListResult {
  const base = {
    senderName: null,
    senderAddress: "a@example.com",
    recipientAddress: "me@neir.io",
    subject: "s",
    receivedAt: "2026-01-01T00:00:00Z",
    isStarred: false,
    isPinned: false,
    hasAttachments: false,
    scheduledFor: null,
    openTrackingEnabled: false,
    openedAt: null,
  };
  return {
    emails: [
      { ...base, id: "one", isRead: false },
      { ...base, id: "two", isRead: false },
    ],
    total: 2,
    page: 1,
    limit: 25,
  };
}

describe("markListedAsRead", () => {
  it("flips only the opened message in every cached list and reports the change", () => {
    const client = new QueryClient();
    client.setQueryData(["emails", "inbox", "f1", 1], list());
    client.setQueryData(["emails", "starred", null, 1], list());

    expect(markListedAsRead(client, "one")).toBe(true);

    for (const key of [
      ["emails", "inbox", "f1", 1],
      ["emails", "starred", null, 1],
    ]) {
      const cached = client.getQueryData<EmailListResult>(key);
      expect(cached?.emails.map((email) => email.isRead)).toEqual([true, false]);
    }
  });

  it("does nothing when the message was already read or is not listed", () => {
    const client = new QueryClient();
    client.setQueryData(["emails", "inbox", "f1", 1], list());
    markListedAsRead(client, "one");
    expect(markListedAsRead(client, "one")).toBe(false);
    expect(markListedAsRead(client, "missing")).toBe(false);
  });
});
