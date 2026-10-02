import { apiRequest } from "../client";
import type {
  AppPasswordCreated,
  AppPasswordSummary,
  Preferences,
  SessionSummary,
  TwoFactorSetup,
  UpdatePreferencesInput,
} from "../types";

export function listSessions(): Promise<SessionSummary[]> {
  return apiRequest<{ sessions: SessionSummary[] }>("GET", "/settings/sessions").then(
    (result) => result.sessions,
  );
}

export function revokeSession(id: string): Promise<void> {
  return apiRequest<void>("DELETE", `/settings/sessions/${id}`);
}

export function revokeAllOtherSessions(): Promise<{ revoked: number }> {
  return apiRequest<{ revoked: number }>("DELETE", "/settings/sessions");
}

export function listAppPasswords(): Promise<AppPasswordSummary[]> {
  return apiRequest<{ appPasswords: AppPasswordSummary[] }>("GET", "/settings/app-passwords").then(
    (result) => result.appPasswords,
  );
}

export function createAppPassword(clientName: string): Promise<AppPasswordCreated> {
  return apiRequest<AppPasswordCreated>("POST", "/settings/app-passwords", {
    body: { clientName },
  });
}

export function deleteAppPassword(id: string): Promise<void> {
  return apiRequest<void>("DELETE", `/settings/app-passwords/${id}`);
}

export function getPreferences(): Promise<Preferences> {
  return apiRequest<Preferences>("GET", "/settings/preferences");
}

export function updatePreferences(input: UpdatePreferencesInput): Promise<Preferences> {
  return apiRequest<Preferences>("PATCH", "/settings/preferences", { body: input });
}

export function setupTwoFactor(): Promise<TwoFactorSetup> {
  return apiRequest<TwoFactorSetup>("POST", "/settings/2fa/setup");
}

export function enableTwoFactor(setup: TwoFactorSetup, code: string): Promise<void> {
  return apiRequest<void>("POST", "/settings/2fa/enable", {
    body: { secret: setup.secret, setupToken: setup.setupToken, code },
  });
}

export function disableTwoFactor(code: string): Promise<void> {
  return apiRequest<void>("POST", "/settings/2fa/disable", { body: { code } });
}

export function regenerateRecoveryPhrase(accountKey: string): Promise<{ recoveryPhrase: string }> {
  return apiRequest<{ recoveryPhrase: string }>("POST", "/settings/recovery-phrase/regenerate", {
    body: { accountKey },
  });
}

export function importPgpKeys(
  accountKey: string,
  encryptedPgpPrivateKey: string,
  pgpPublicKey: string,
): Promise<void> {
  return apiRequest<void>("POST", "/settings/pgp/import", {
    body: { accountKey, encryptedPgpPrivateKey, pgpPublicKey },
  });
}
