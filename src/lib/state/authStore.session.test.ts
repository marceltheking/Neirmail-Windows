import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  login: vi.fn(),
  login2fa: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  getPgpSettings: vi.fn(),
  persistSession: vi.fn(),
  forgetPersistedSession: vi.fn(),
  restoreSession: vi.fn(),
}));
const cipher = vi.hoisted(() => ({ decryptPrivateKey: vi.fn() }));
const cache = vi.hoisted(() => ({ clearLocalCache: vi.fn() }));

vi.mock("../api/endpoints/auth", () => auth);
vi.mock("../crypto/accountKeyCipher", () => cipher);
vi.mock("../cache/localCache", () => cache);
vi.mock("../api/endpoints/attachments", () => ({
  clearStagedAttachments: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../ws/mailEvents", () => ({
  startMailEvents: vi.fn().mockResolvedValue(undefined),
  stopMailEvents: vi.fn().mockResolvedValue(undefined),
  setNotificationPreviewsHidden: vi.fn(),
}));

import { getKeySession } from "../crypto/keySession";
import { ApiError } from "../api/types";
import { outgoingCount, queueOutgoing } from "../mail/outbox";
import { queryClient } from "../queryClient";
import { useAuthStore } from "./authStore";
import { useMailStore } from "./mailStore";
import { triggerSessionLost } from "../api/client";

function setSessionLostHandlerProbe() {
  triggerSessionLost();
}

const account = { userId: "user-1", displayName: "Avery", twofaActive: false };
const privateKey =
  "-----BEGIN PGP PRIVATE KEY BLOCK-----\nkey\n-----END PGP PRIVATE KEY BLOCK-----";

beforeEach(() => {
  vi.clearAllMocks();
  auth.me.mockResolvedValue(account);
  auth.getPgpSettings.mockResolvedValue({ encryptedPrivateKey: "iv.cipher" });
  auth.logout.mockResolvedValue(undefined);
  auth.forgetPersistedSession.mockResolvedValue(undefined);
  cache.clearLocalCache.mockResolvedValue(undefined);
  useAuthStore.setState({ phase: "locked", me: null, error: null, busy: false });
});

describe("boot", () => {
  it("locks the workspace when a saved session is still valid", async () => {
    useAuthStore.setState({ phase: "booting" });
    auth.restoreSession.mockResolvedValue(true);
    await useAuthStore.getState().boot();
    expect(useAuthStore.getState().phase).toBe("locked");
  });

  it("falls back to sign in when there is no saved session or the check fails", async () => {
    useAuthStore.setState({ phase: "booting" });
    auth.restoreSession.mockResolvedValue(false);
    await useAuthStore.getState().boot();
    expect(useAuthStore.getState().phase).toBe("signed_out");

    useAuthStore.setState({ phase: "booting" });
    auth.restoreSession.mockRejectedValue(new Error("offline"));
    await useAuthStore.getState().boot();
    expect(useAuthStore.getState().phase).toBe("signed_out");
  });
});

describe("unlock", () => {
  it("opens the mailbox and keeps the private key when the account key is right", async () => {
    cipher.decryptPrivateKey.mockResolvedValue(privateKey);
    await useAuthStore.getState().unlock("ABCD-ABCD-ABCD-ABCD");
    expect(useAuthStore.getState().phase).toBe("authenticated");
    expect(getKeySession(account.userId)).toBe(privateKey);
  });

  it("stays locked and reports the error when the account key is wrong", async () => {
    cipher.decryptPrivateKey.mockRejectedValue(new Error("bad key"));
    await useAuthStore.getState().unlock("ABCD-ABCD-ABCD-ABCD");
    const state = useAuthStore.getState();
    expect(state.phase).toBe("locked");
    expect(state.error).toBe("That account key is not recognized.");
    expect(state.busy).toBe(false);
    expect(getKeySession(account.userId)).toBeNull();
  });
});

describe("unlock after the server session expired", () => {
  it("signs out and says the session expired instead of blaming the key", async () => {
    auth.me.mockRejectedValue(
      new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials." }),
    );
    await useAuthStore.getState().unlock("ABCD-ABCD-ABCD-ABCD");
    const state = useAuthStore.getState();
    expect(state.phase).toBe("signed_out");
    expect(state.error).toBe("Your session expired. Sign in again with your Account Key.");
    expect(cipher.decryptPrivateKey).not.toHaveBeenCalled();
  });
});

describe("unlock without a stored key", () => {
  it("never opens the mailbox when there is nothing to verify the key against", async () => {
    auth.getPgpSettings.mockResolvedValue({ encryptedPrivateKey: null });
    await useAuthStore.getState().unlock("ABCD-ABCD-ABCD-ABCD");
    expect(useAuthStore.getState().phase).toBe("locked");
    expect(useAuthStore.getState().error).toBe("That account key is not recognized.");
  });
});

describe("expired sessions", () => {
  it("returns to sign in with an explanation", async () => {
    useAuthStore.setState({ phase: "authenticated", me: { ...account } as never });
    setSessionLostHandlerProbe();
    await vi.waitFor(() => expect(useAuthStore.getState().phase).toBe("signed_out"));
    expect(useAuthStore.getState().error).toBe("Your session expired. Log in again.");
  });
});

describe("logout", () => {
  it("wipes everything the previous account left behind", async () => {
    queryClient.setQueryData(["folders"], [{ id: "inbox" }]);
    useMailStore.setState({ selectedEmailId: "mail-1", selectedIds: new Set(["mail-1"]) });
    useAuthStore.setState({ phase: "authenticated", me: { ...account } as never });

    await useAuthStore.getState().logout();

    expect(queryClient.getQueryData(["folders"])).toBeUndefined();
    expect(useMailStore.getState().selectedEmailId).toBeNull();
    expect(useMailStore.getState().selectedIds.size).toBe(0);
    expect(cache.clearLocalCache).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().phase).toBe("signed_out");
    expect(useAuthStore.getState().me).toBeNull();
  });

  it("sends a message still waiting in the undo window before signing out", async () => {
    const deliver = vi.fn().mockResolvedValue(undefined);
    queueOutgoing({
      delayMs: 5000,
      deliver,
      keep: vi.fn(),
      onSent: vi.fn(),
      onFailed: vi.fn(),
    });
    useAuthStore.setState({ phase: "authenticated", me: { ...account } as never });

    await useAuthStore.getState().logout();

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(outgoingCount()).toBe(0);
    expect(deliver.mock.invocationCallOrder[0]).toBeLessThan(
      auth.logout.mock.invocationCallOrder[0],
    );
  });

  it("still signs out locally when the server cannot be reached", async () => {
    auth.logout.mockRejectedValue(new Error("offline"));
    useAuthStore.setState({ phase: "authenticated", me: { ...account } as never });

    await useAuthStore
      .getState()
      .logout()
      .catch(() => undefined);

    expect(useAuthStore.getState().phase).toBe("signed_out");
    expect(cache.clearLocalCache).toHaveBeenCalledTimes(1);
  });
});
