// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: { payload: unknown }) => Promise<void>;

const bridge = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload: unknown }) => Promise<void> | void>(),
  callCommand: vi.fn(),
  isPermissionGranted: vi.fn(),
  listEmails: vi.fn(),
  getPreferences: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, callback: Listener) => {
    bridge.listeners.set(name, callback);
    return () => {
      bridge.listeners.delete(name);
    };
  }),
}));
vi.mock("../api/client", () => ({ callCommand: bridge.callCommand }));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: bridge.isPermissionGranted,
}));
vi.mock("../api/endpoints/emails", () => ({ listEmails: bridge.listEmails }));
vi.mock("../api/endpoints/settings", () => ({ getPreferences: bridge.getPreferences }));

import { queryClient } from "../queryClient";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { setNotificationPreviewsHidden, startMailEvents, stopMailEvents } from "./mailEvents";

let sequence = 0;

const folders = [
  { id: "inbox-id", type: "inbox" },
  { id: "spam-id", type: "spam" },
];

function newMail(folderId: string) {
  return bridge.listeners.get("mail-event")?.({
    payload: JSON.stringify({ type: "new-mail", folderId }),
  });
}

function notifications() {
  return bridge.callCommand.mock.calls.filter(([name]) => name === "show_native_notification");
}

beforeEach(async () => {
  vi.clearAllMocks();
  bridge.callCommand.mockResolvedValue(undefined);
  bridge.isPermissionGranted.mockResolvedValue(true);
  sequence += 1;
  bridge.listEmails.mockResolvedValue({
    emails: [
      {
        id: `mail-${sequence}`,
        senderName: "Mara",
        senderAddress: "mara@example.com",
        subject: "Hi",
      },
    ],
  });
  queryClient.setQueryData(["preferences"], { desktopNotificationsEnabled: true });
  queryClient.setQueryData(["folders"], folders);
  useAppSettingsStore.setState({ notificationPreview: true, notificationSound: true });
  vi.spyOn(document, "hasFocus").mockReturnValue(false);
  await startMailEvents();
});

afterEach(async () => {
  await stopMailEvents();
  queryClient.clear();
  vi.restoreAllMocks();
});

describe("new mail notifications", () => {
  it("notifies with the sender, subject and a sound when the window is in the background", async () => {
    await newMail("inbox-id");
    expect(notifications()).toEqual([
      ["show_native_notification", { title: "Mara", body: "Hi", sound: true }],
    ]);
  });

  it("respects the sound setting", async () => {
    useAppSettingsStore.setState({ notificationSound: false });
    await newMail("inbox-id");
    expect(notifications()[0][1]).toMatchObject({ sound: false });
  });

  it("stays quiet while the window has focus", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    await newMail("inbox-id");
    expect(notifications()).toEqual([]);
  });

  it("does not notify for spam", async () => {
    await newMail("spam-id");
    expect(notifications()).toEqual([]);
  });

  it("hides message details when previews are off", async () => {
    useAppSettingsStore.setState({ notificationPreview: false });
    await newMail("inbox-id");
    expect(notifications()[0][1]).toMatchObject({
      title: "New message",
      body: "Open Neir Mail to read it.",
    });
  });

  it("hides sender and subject while the app is locked", async () => {
    setNotificationPreviewsHidden(true);
    await newMail("inbox-id");
    setNotificationPreviewsHidden(false);
    expect(notifications()[0][1]).toMatchObject({
      title: "New message",
      body: "Open Neir Mail to read it.",
    });
    expect(bridge.listEmails).not.toHaveBeenCalled();
  });

  it("previews the newest unpinned message instead of a pinned broadcast", async () => {
    const pinned = {
      id: "pinned",
      isPinned: true,
      senderAddress: "news@neir.io",
      subject: "Pinned",
    };
    bridge.listEmails.mockResolvedValue({
      emails: [pinned, { id: "first", senderName: "Ada", senderAddress: "a@x.io", subject: "One" }],
    });
    await newMail("inbox-id");
    bridge.listEmails.mockResolvedValue({
      emails: [
        pinned,
        { id: "second", senderName: "Lin", senderAddress: "l@x.io", subject: "Two" },
      ],
    });
    await newMail("inbox-id");
    expect(notifications().map(([, args]) => args.title)).toEqual(["Ada", "Lin"]);
  });

  it("refreshes the mailbox when the live connection is re-established", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await bridge.listeners.get("mail-connected")?.({ payload: null });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["emails"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["folders"] });
  });

  it("asks for permission again after it was denied", async () => {
    bridge.isPermissionGranted.mockResolvedValue(false);
    await newMail("inbox-id");
    expect(notifications()).toEqual([]);

    bridge.isPermissionGranted.mockResolvedValue(true);
    bridge.listEmails.mockResolvedValue({
      emails: [
        { id: "mail-later", senderName: null, senderAddress: "lin@example.com", subject: "" },
      ],
    });
    await newMail("inbox-id");
    expect(notifications()).toHaveLength(1);
  });
});
