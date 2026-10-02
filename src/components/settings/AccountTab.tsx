import { useState } from "react";
import { deleteAccount, downloadAccountExport } from "../../lib/api/endpoints/account";
import { normalizeAccountKey, useAuthStore } from "../../lib/state/authStore";
import { useToastStore } from "../../lib/state/toastStore";
import { DownloadSimple, Trash, UserCircle } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export function AccountTab() {
  const logout = useAuthStore((state) => state.logout);
  const showToast = useToastStore((state) => state.show);
  const [accountKey, setAccountKey] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setBusy(true);
    setError(null);
    try {
      const path = await downloadAccountExport();
      showToast("Encrypted export saved", {
        label: "Show in folder",
        onClick: () =>
          void revealItemInDir(path).catch(() => showToast("Could not reveal the export.")),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the encrypted export.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    const normalized = normalizeAccountKey(accountKey);
    if (confirmText !== "DELETE" || normalized.length !== 16) {
      setError("Enter your Account Key and type DELETE exactly.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(normalized);
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the account.");
      setBusy(false);
    }
  }

  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <UserCircle weight="duotone" />
        </div>
        <div>
          <h1>Account</h1>
          <p>Export your data or permanently close your Neir account.</p>
        </div>
      </header>
      <section className="settings-section-card">
        <div className="settings-card-head">
          <div>
            <h2>Encrypted export</h2>
            <p>Save an encrypted archive of your mailbox and account data to Downloads.</p>
          </div>
          <Button variant="secondary" icon={<DownloadSimple />} loading={busy} onClick={exportData}>
            Download export
          </Button>
        </div>
      </section>

      <section className="settings-danger-zone">
        <div className="settings-card-title-row">
          <Trash weight="duotone" />
          <div>
            <h2>Delete account</h2>
            <p>
              This permanently removes your mailbox, aliases, messages, settings, and active
              sessions. This cannot be undone.
            </p>
          </div>
        </div>
        <Field
          label="Confirm Account Key"
          type="password"
          value={accountKey}
          onChange={(event) => setAccountKey(event.target.value)}
          placeholder="Account Key"
          autoComplete="off"
        />
        <Field
          label="Confirmation"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
        />
        <Button
          variant="danger"
          icon={<Trash />}
          loading={busy}
          disabled={!accountKey || confirmText !== "DELETE"}
          onClick={removeAccount}
        >
          Permanently delete account
        </Button>
      </section>
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
