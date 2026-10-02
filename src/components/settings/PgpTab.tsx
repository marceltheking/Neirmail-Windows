import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPgpSettings } from "../../lib/api/endpoints/auth";
import { importPgpKeys } from "../../lib/api/endpoints/settings";
import { encryptPrivateKey } from "../../lib/crypto/accountKeyCipher";
import { generatePgpKeyPair } from "../../lib/crypto/keygen";
import { storeKeySession } from "../../lib/crypto/keySession";
import { normalizeAccountKey, useAuthStore } from "../../lib/state/authStore";
import { useToastStore } from "../../lib/state/toastStore";
import { ApiError } from "../../lib/api/types";
import { Fingerprint, Key, LockKey, Warning } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { ErrorState, Skeleton } from "../ui/States";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";

function describeKeyError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 401) return "That Account Key is not correct.";
  return err instanceof Error && err.message ? err.message : fallback;
}

export function PgpTab() {
  const pgpQuery = useQuery({ queryKey: ["pgp-settings"], queryFn: getPgpSettings });
  const data = pgpQuery.data;
  const me = useAuthStore((state) => state.me);
  const showToast = useToastStore((state) => state.show);
  const queryClient = useQueryClient();
  const [privateKey, setPrivateKey] = useState("");
  const [accountKey, setAccountKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacementAction, setReplacementAction] = useState<"import" | "generate" | null>(null);

  if (pgpQuery.isPending) return <Skeleton lines={6} />;
  if (pgpQuery.isError || !data) {
    return (
      <ErrorState
        title="PGP settings could not be loaded"
        description={
          pgpQuery.error instanceof ApiError
            ? pgpQuery.error.message
            : "Check your connection and try again."
        }
        onRetry={() => void pgpQuery.refetch()}
      />
    );
  }

  async function saveKeys(privateKeyArmored: string, publicKeyArmored: string) {
    const normalized = normalizeAccountKey(accountKey);
    if (normalized.length !== 16) throw new Error("Enter your full 16-character Account Key.");
    const encrypted = await encryptPrivateKey(normalized, privateKeyArmored);
    await importPgpKeys(normalized, encrypted, publicKeyArmored);
    if (me) storeKeySession(me.userId, privateKeyArmored);
    await queryClient.invalidateQueries({ queryKey: ["pgp-settings"] });
    setPrivateKey("");
    setAccountKey("");
  }

  async function importKey() {
    if (!privateKey.includes("PRIVATE KEY BLOCK")) {
      setError("Paste an armored PGP private key block.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const openpgp = await import("openpgp");
      const parsed = await openpgp.readPrivateKey({ armoredKey: privateKey.trim() }).catch(() => {
        throw new Error("That is not a valid armored PGP private key.");
      });
      if (!parsed.isDecrypted()) {
        throw new Error(
          "This private key is protected by a passphrase. Remove the passphrase before importing it.",
        );
      }
      await saveKeys(parsed.armor(), parsed.toPublic().armor());
      setReplacementAction(null);
      showToast("PGP key imported");
    } catch (err) {
      setReplacementAction(null);
      setError(describeKeyError(err, "Could not import that PGP key."));
    } finally {
      setBusy(false);
    }
  }

  async function generateKey() {
    setBusy(true);
    setError(null);
    try {
      const generated = await generatePgpKeyPair(me?.displayName ?? undefined);
      await saveKeys(generated.privateKey, generated.publicKey);
      setReplacementAction(null);
      showToast("New PGP key generated");
    } catch (err) {
      setReplacementAction(null);
      setError(describeKeyError(err, "Could not generate a new PGP key."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <LockKey weight="duotone" />
        </div>
        <div>
          <h1>PGP identity</h1>
          <p>Review the public key used to encrypt your Neir mail.</p>
        </div>
      </header>
      <section className="settings-section-card">
        <div className="settings-card-title-row">
          <Fingerprint weight="duotone" />
          <div>
            <h2>Current key</h2>
            <p>The private half is unlocked locally and never leaves this device unencrypted.</p>
          </div>
        </div>
        <div className="settings-field">
          <label>Fingerprint</label>
          <code className="settings-code">{data.fingerprint}</code>
        </div>
        <details className="settings-disclosure">
          <summary>View armored public key</summary>
          <textarea className="settings-code-block" readOnly value={data.publicKey} rows={8} />
        </details>
      </section>
      <section className="settings-danger-zone">
        <div className="settings-card-title-row">
          <Warning weight="fill" />
          <div>
            <h2>Replace key pair</h2>
            <p>
              Existing encrypted messages may become unreadable. Safely retain your current private
              key first.
            </p>
          </div>
        </div>
        <label className="ui-field">
          <span className="ui-field-label">Armored private key</span>
          <textarea
            className="settings-key-area"
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            placeholder="Paste a PGP private key, or leave blank to generate one"
          />
        </label>
        <Field
          label="Confirm Account Key"
          type="password"
          value={accountKey}
          onChange={(event) => setAccountKey(event.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
        />
        <div className="settings-row-actions">
          <Button
            variant="secondary"
            icon={<Key />}
            loading={busy}
            disabled={!privateKey.trim() || !accountKey.trim()}
            onClick={() => setReplacementAction("import")}
          >
            Import key
          </Button>
          <Button
            variant="danger"
            icon={<Warning />}
            loading={busy}
            disabled={!accountKey.trim()}
            onClick={() => setReplacementAction("generate")}
          >
            Generate replacement
          </Button>
        </div>
      </section>
      {error && <div className="auth-error">{error}</div>}
      {replacementAction && (
        <ConfirmationDialog
          title={
            replacementAction === "import"
              ? "Import this replacement key?"
              : "Generate a replacement key?"
          }
          description="Neir Mail will replace the PGP identity used for new encrypted mailbox content."
          confirmLabel={
            replacementAction === "import" ? "Import replacement" : "Generate replacement"
          }
          busy={busy}
          onCancel={() => setReplacementAction(null)}
          onConfirm={() => void (replacementAction === "import" ? importKey() : generateKey())}
          detail="Messages encrypted only to the current key may become unreadable unless you retain that private key."
        />
      )}
    </div>
  );
}
