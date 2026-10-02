import { create } from "zustand";
import {
  login,
  login2fa,
  logout as apiLogout,
  me as fetchMe,
  getPgpSettings,
  persistSession,
  forgetPersistedSession,
  restoreSession,
} from "../api/endpoints/auth";
import { decryptPrivateKey } from "../crypto/accountKeyCipher";
import { storeKeySession, clearKeySession } from "../crypto/keySession";
import { ApiError, type Me } from "../api/types";
import { setSessionLostHandler } from "../api/client";
import { setNotificationPreviewsHidden, startMailEvents, stopMailEvents } from "../ws/mailEvents";
import { clearLocalCache } from "../cache/localCache";
import { clearStagedAttachments } from "../api/endpoints/attachments";
import { flushOutgoing } from "../mail/outbox";
import { queryClient } from "../queryClient";
import { useComposeStore } from "./composeStore";
import { useMailStore } from "./mailStore";
import { useSenderIconStore } from "./senderIconStore";

export function normalizeAccountKey(raw: string): string {
  let stripped = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (stripped.slice(0, 4) === "NEIR") stripped = stripped.slice(4);
  return stripped;
}

type AuthPhase = "booting" | "signed_out" | "awaiting_2fa" | "locked" | "authenticated";

interface AuthState {
  phase: AuthPhase;
  me: Me | null;
  pendingPreAuthToken: string | null;
  pendingAccountKey: string | null;
  error: string | null;
  busy: boolean;
  boot: () => Promise<void>;
  submitAccountKey: (raw: string) => Promise<void>;
  submitTwoFactorCode: (code: string) => Promise<void>;
  cancelTwoFactor: () => void;
  unlock: (raw: string) => Promise<void>;
  lock: () => void;
  updateTwoFactorStatus: (active: boolean) => void;
  refreshProfile: () => Promise<void>;
  forgetDevice: () => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

function describeLoginError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return "Could not reach Neir. Check your connection and try again.";
    if (err.code === "ACCOUNT_BANNED") return "This account has been banned.";
    if (err.code === "ACCOUNT_SUSPENDED") return "This account is suspended.";
    if (err.status === 429) return "Too many attempts. Try again later.";
  }
  return "That account key is not recognized.";
}

function describeTwoFactorError(err: unknown): string {
  if (err instanceof ApiError && err.status === 401 && err.code === "INVALID_CREDENTIALS") {
    return "Invalid or expired code. Try again, or log in again if it has expired.";
  }
  return "Something went wrong. Try again.";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  phase: "booting",
  me: null,
  pendingPreAuthToken: null,
  pendingAccountKey: null,
  error: null,
  busy: false,

  boot: async () => {
    const restored = await restoreSession().catch(() => false);
    if (get().phase !== "booting") return;
    set({ phase: restored ? "locked" : "signed_out" });
    if (restored) {
      setNotificationPreviewsHidden(true);
      startMailEventsInBackground();
    }
  },

  submitAccountKey: async (raw) => {
    set({ error: null });
    const accountKey = normalizeAccountKey(raw);
    if (accountKey.length !== 16) {
      set({ error: "Enter your full 16-character account key." });
      return;
    }

    set({ busy: true });
    try {
      const result = await login(accountKey);
      if (result.status === "requires_2fa") {
        set({
          phase: "awaiting_2fa",
          pendingPreAuthToken: result.preAuthToken,
          pendingAccountKey: accountKey,
          busy: false,
        });
        return;
      }
      await completeLogin(accountKey);
      await persistSession();
    } catch (err) {
      set({ error: describeLoginError(err), busy: false });
    }
  },

  submitTwoFactorCode: async (code) => {
    set({ error: null });
    const { pendingPreAuthToken, pendingAccountKey } = get();
    if (!pendingPreAuthToken || !pendingAccountKey) {
      set({ error: "Your login attempt expired. Please log in again.", phase: "signed_out" });
      return;
    }
    if (code.length !== 6) {
      set({ error: "Enter the 6-digit code." });
      return;
    }

    set({ busy: true });
    try {
      await login2fa(pendingPreAuthToken, code);
      await completeLogin(pendingAccountKey);
      await persistSession();
    } catch (err) {
      set({ error: describeTwoFactorError(err), busy: false });
    }
  },

  cancelTwoFactor: () => {
    set({ phase: "signed_out", pendingPreAuthToken: null, pendingAccountKey: null, error: null });
  },

  unlock: async (raw) => {
    set({ error: null });
    const accountKey = normalizeAccountKey(raw);
    if (accountKey.length !== 16) {
      set({ error: "Enter your full 16-character account key." });
      return;
    }
    set({ busy: true });
    try {
      await fetchMe();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await get().logout();
        set({ error: "Your session expired. Sign in again with your Account Key." });
        return;
      }
      set({ error: describeLoginError(err), busy: false });
      return;
    }
    try {
      await completeLogin(accountKey, { requireKey: true });
    } catch (err) {
      set({ error: describeLoginError(err), busy: false });
    }
  },

  lock: () => {
    if (get().phase !== "authenticated") return;
    clearKeySession();
    setNotificationPreviewsHidden(true);
    useMailStore.setState({ selectedEmailId: null, selectedIds: new Set() });
    set({ phase: "locked", error: null, busy: false });
  },

  updateTwoFactorStatus: (active) => {
    const current = get().me;
    if (current) set({ me: { ...current, twofaActive: active } });
  },

  refreshProfile: async () => {
    set({ me: await fetchMe() });
  },

  forgetDevice: () => {
    void get().logout();
  },

  logout: async () => {
    await flushOutgoing().catch(() => undefined);
    await apiLogout().catch(() => undefined);
    await stopMailEvents().catch(() => undefined);
    setNotificationPreviewsHidden(false);
    await forgetPersistedSession().catch(() => undefined);
    clearKeySession();
    queryClient.clear();
    useSenderIconStore.getState().reset();
    useMailStore.setState({
      nav: { kind: "inbox", folderId: null },
      selectedEmailId: null,
      selectedIds: new Set(),
    });
    useComposeStore.getState().close();
    await clearLocalCache().catch(() => undefined);
    await clearStagedAttachments().catch(() => undefined);
    set({
      phase: "signed_out",
      me: null,
      pendingAccountKey: null,
      pendingPreAuthToken: null,
      busy: false,
    });
  },

  clearError: () => set({ error: null }),
}));

async function completeLogin(
  accountKey: string,
  options: { requireKey?: boolean } = {},
): Promise<void> {
  const me = await fetchMe();
  clearKeySession();
  const pgp = await getPgpSettings().catch((err) => {
    if (options.requireKey) throw err;
    return null;
  });
  if (options.requireKey && !pgp?.encryptedPrivateKey) {
    throw new ApiError({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "That account key is not recognized.",
    });
  }
  if (pgp?.encryptedPrivateKey) {
    try {
      const privateKey = await decryptPrivateKey(accountKey, pgp.encryptedPrivateKey);
      storeKeySession(me.userId, privateKey);
    } catch {
      clearKeySession();
      if (options.requireKey) {
        throw new ApiError({
          status: 401,
          code: "INVALID_CREDENTIALS",
          message: "That account key is not recognized.",
        });
      }
    }
  }
  useAuthStore.setState({
    phase: "authenticated",
    me,
    pendingAccountKey: null,
    pendingPreAuthToken: null,
    busy: false,
  });
  setNotificationPreviewsHidden(false);
  startMailEventsInBackground();
}

function startMailEventsInBackground(): void {
  void startMailEvents().catch(() => {});
}

setSessionLostHandler(() => {
  if (useAuthStore.getState().phase !== "authenticated") return;
  void useAuthStore
    .getState()
    .logout()
    .then(() => useAuthStore.setState({ error: "Your session expired. Log in again." }));
});
