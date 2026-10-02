import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  listAppPasswords,
  createAppPassword,
  deleteAppPassword,
} from "../../lib/api/endpoints/settings";
import { formatFullDate } from "../../lib/format/date";
import { copyText } from "../../lib/native/clipboard";
import { ApiError } from "../../lib/api/types";
import { Copy, Key, Plus, Trash } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import type { AppPasswordSummary } from "../../lib/api/types";
import { Checkbox } from "../ui/Checkbox";
import { useToastStore } from "../../lib/state/toastStore";

export function AppPasswordsTab() {
  const showToast = useToastStore((state) => state.show);
  const [clientName, setClientName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealedSaved, setRevealedSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordToDelete, setPasswordToDelete] = useState<AppPasswordSummary | null>(null);
  const queryClient = useQueryClient();

  const passwordQuery = useQuery({
    queryKey: ["app-passwords"],
    queryFn: listAppPasswords,
  });
  const appPasswords = passwordQuery.data ?? [];

  const create = useMutation({
    mutationFn: createAppPassword,
    onSuccess: (result) => {
      setRevealed(result.plaintext);
      setRevealedSaved(false);
      setClientName("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["app-passwords"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create that."),
  });

  const remove = useMutation({
    mutationFn: deleteAppPassword,
    onSuccess: () => {
      setPasswordToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["app-passwords"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not revoke that app password."),
  });

  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <Key weight="duotone" />
        </div>
        <div>
          <h1>App passwords</h1>
          <p>Connect third-party clients over IMAP, SMTP, or POP3.</p>
        </div>
      </header>
      {revealed && (
        <section className="settings-secret-reveal">
          <div>
            <strong>Copy this password now</strong>
            <span>It cannot be shown again after dismissal.</span>
          </div>
          <button
            type="button"
            onClick={() =>
              void copyText(revealed)
                .then(() => showToast("App password copied"))
                .catch(() => showToast("Could not copy the app password."))
            }
          >
            <code>{revealed}</code>
            <Copy />
          </button>
          <label className="settings-secret-ack">
            <Checkbox
              checked={revealedSaved}
              onCheckedChange={setRevealedSaved}
              label="I saved this app password"
            />
            <span>I saved this password somewhere secure.</span>
          </label>
          <Button variant="ghost" disabled={!revealedSaved} onClick={() => setRevealed(null)}>
            Dismiss
          </Button>
        </section>
      )}
      <section className="settings-section-card">
        <div className="settings-card-head">
          <div>
            <h2>Create password</h2>
            <p>Use a descriptive device or client name. The password is shown once.</p>
          </div>
        </div>
        <div className="settings-inline-form">
          <Field
            label="Client name"
            placeholder="Thunderbird on desktop"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
          />
          <Button
            icon={<Plus />}
            loading={create.isPending}
            disabled={!clientName.trim()}
            onClick={() => create.mutate(clientName.trim())}
          >
            Create
          </Button>
        </div>
      </section>
      {error && <div className="modal-error">{error}</div>}
      <section className="settings-section-card">
        <h2>Existing passwords</h2>
        <div className="settings-list">
          {passwordQuery.isPending ? (
            <Skeleton lines={3} />
          ) : passwordQuery.isError ? (
            <ErrorState
              title="App passwords could not be loaded"
              description={
                passwordQuery.error instanceof ApiError
                  ? passwordQuery.error.message
                  : "Check your connection and try again."
              }
              onRetry={() => void passwordQuery.refetch()}
            />
          ) : appPasswords.length === 0 ? (
            <EmptyState
              icon={<Key />}
              title="No app passwords"
              description="Create one to use Neir mail in another client."
            />
          ) : null}
          {!passwordQuery.isError &&
            appPasswords.map((entry) => (
              <div key={entry.id} className="settings-row">
                <div>
                  <div className="settings-row-title">{entry.clientName}</div>
                  <div className="settings-row-sub">Created {formatFullDate(entry.createdAt)}</div>
                </div>
                <IconButton
                  danger
                  label={`Delete ${entry.clientName}`}
                  icon={<Trash />}
                  onClick={() => setPasswordToDelete(entry)}
                />
              </div>
            ))}
        </div>
      </section>
      {passwordToDelete && (
        <ConfirmationDialog
          title={`Revoke “${passwordToDelete.clientName}”?`}
          description="That mail client will lose IMAP, SMTP, and POP3 access immediately."
          confirmLabel="Revoke password"
          busy={remove.isPending}
          onCancel={() => setPasswordToDelete(null)}
          onConfirm={() => remove.mutate(passwordToDelete.id)}
        />
      )}
    </div>
  );
}
