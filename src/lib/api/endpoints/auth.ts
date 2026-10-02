import { callCommand } from "../client";
import type { LoginOutcome, Me, PgpSettings } from "../types";

export function login(accountKey: string): Promise<LoginOutcome> {
  return callCommand<LoginOutcome>("login", { accountKey });
}

export function login2fa(preAuthToken: string, code: string): Promise<void> {
  return callCommand<void>("login_2fa", { preAuthToken, code });
}

export function logout(): Promise<void> {
  return callCommand<void>("logout");
}

export function me(): Promise<Me> {
  return callCommand<Me>("me");
}

export function getPgpSettings(): Promise<PgpSettings> {
  return callCommand<PgpSettings>("get_pgp_settings");
}

export function persistSession(): Promise<void> {
  return callCommand<void>("persist_session");
}

export function restoreSession(): Promise<boolean> {
  return callCommand<boolean>("restore_session");
}

export function forgetPersistedSession(): Promise<void> {
  return callCommand<void>("forget_persisted_session");
}
