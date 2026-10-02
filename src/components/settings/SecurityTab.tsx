import { useState } from "react";
import { Copy, Key, ShieldCheck, ShieldSlash } from "@phosphor-icons/react";
import { regenerateRecoveryPhrase } from "../../lib/api/endpoints/settings";
import { normalizeAccountKey, useAuthStore } from "../../lib/state/authStore";
import { copyText } from "../../lib/native/clipboard";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { TwoFactorModal } from "./TwoFactorModal";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import { useToastStore } from "../../lib/state/toastStore";

export function SecurityTab() {
  const showToast = useToastStore((state) => state.show);
  const active = useAuthStore((state) => Boolean(state.me?.twofaActive));
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [accountKey, setAccountKey] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  function requestRegenerate() {
    const normalized = normalizeAccountKey(accountKey);
    if (normalized.length !== 16) {
      setError("Enter your full 16-character Account Key.");
      return;
    }
    setError(null);
    setConfirmRegenerate(true);
  }

  async function regenerate() {
    const normalized = normalizeAccountKey(accountKey);
    setBusy(true);
    setError(null);
    try {
      const result = await regenerateRecoveryPhrase(normalized);
      setRecoveryPhrase(result.recoveryPhrase);
      setAccountKey("");
      setConfirmRegenerate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate the recovery phrase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-tab settings-tab-v2 security-settings-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <ShieldCheck weight="duotone" />
        </div>
        <div>
          <h1>Security</h1>
          <p>Strengthen sign-in and maintain your private recovery path.</p>
        </div>
      </header>
      <section className="settings-feature-row">
        <span className={`settings-feature-icon ${active ? "active" : ""}`}>
          {active ? <ShieldCheck weight="fill" /> : <ShieldSlash />}
        </span>
        <div>
          <h3>Two-factor authentication</h3>
          <p className="settings-hint">
            Require an authenticator code when your Account Key is used on a new device.
          </p>
        </div>
        <div className="settings-feature-action">
          <span>{active ? "Enabled" : "Disabled"}</span>
          <Button variant={active ? "secondary" : "primary"} onClick={() => setTwoFactorOpen(true)}>
            {active ? "Manage" : "Set up"}
          </Button>
        </div>
      </section>

      <section className="settings-recovery-card">
        <div className="settings-recovery-heading">
          <span className="settings-feature-icon">
            <Key />
          </span>
          <div>
            <h3>Recovery phrase</h3>
            <p className="settings-hint">
              Generate a new 12-word phrase. Your previous phrase stops working immediately.
            </p>
          </div>
        </div>
        {recoveryPhrase ? (
          <div className="settings-recovery-reveal">
            <code>{recoveryPhrase}</code>
            <p>Save this now. It will not be shown again after leaving this page.</p>
            <Button
              variant="secondary"
              icon={<Copy />}
              onClick={() =>
                void copyText(recoveryPhrase)
                  .then(() => showToast("Recovery phrase copied"))
                  .catch(() => showToast("Could not copy the recovery phrase."))
              }
            >
              Copy phrase
            </Button>
          </div>
        ) : (
          <div className="settings-recovery-confirm">
            <Field
              label="Confirm Account Key"
              type="password"
              value={accountKey}
              onChange={(event) => setAccountKey(event.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
            />
            <p>Your key is only used to authorize this change.</p>
            <Button variant="danger" icon={<Key />} loading={busy} onClick={requestRegenerate}>
              Generate new phrase
            </Button>
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}
      </section>
      {twoFactorOpen && <TwoFactorModal onClose={() => setTwoFactorOpen(false)} />}
      {confirmRegenerate && (
        <ConfirmationDialog
          title="Replace your recovery phrase?"
          description="The current recovery phrase will stop working as soon as the replacement is generated."
          confirmLabel="Replace phrase"
          busy={busy}
          onCancel={() => setConfirmRegenerate(false)}
          onConfirm={() => void regenerate()}
          detail="Save the new 12-word phrase before leaving this page. Neir cannot show it again."
        />
      )}
    </div>
  );
}
