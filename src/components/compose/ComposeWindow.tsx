import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarBlank,
  Clock,
  FloppyDisk,
  PaperPlaneTilt,
  Paperclip,
  Trash,
  X,
} from "@phosphor-icons/react";
import {
  pickAttachments,
  sendCompose,
  saveDraft,
  scheduleSend,
} from "../../lib/api/endpoints/compose";
import { ApiError } from "../../lib/api/types";
import { formatBytes } from "../../lib/format/bytes";
import { useMailStore } from "../../lib/state/mailStore";
import { queueOutgoing } from "../../lib/mail/outbox";
import { recipientValidationError } from "../../lib/mail/recipients";
import {
  useComposeStore,
  type ComposeDefaults,
  type KeptAttachment,
} from "../../lib/state/composeStore";
import { primaryAddress, useAddresses } from "../../lib/hooks/useAddresses";
import { useToastStore } from "../../lib/state/toastStore";
import { Modal, ModalClose } from "../shared/Modal";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";

const UNDO_SEND_DELAY_MS = 5000;
const MAX_ATTACHMENTS = 10;

const TITLES = { new: "New message", reply: "Reply", forward: "Forward", draft: "Edit draft" };

function composeTitle(defaults: ComposeDefaults): string {
  if (defaults.kind === "draft" && defaults.scheduledFor) return "Edit scheduled message";
  return TITLES[defaults.kind ?? (defaults.inReplyTo ? "reply" : "new")];
}

function localDateTimeValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultScheduleTime(existing?: string): string {
  if (existing && new Date(existing).getTime() > Date.now() + 5 * 60 * 1000) {
    return localDateTimeValue(new Date(existing));
  }
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return localDateTimeValue(date);
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || "Attachment";
}

function composeSignature({
  to,
  cc,
  bcc,
  subject,
  body,
  attachmentPaths,
  keptAttachments,
}: {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachmentPaths: string[];
  keptAttachments: KeptAttachment[];
}): string {
  const kept = keptAttachments.map((attachment) => attachment.id);
  return JSON.stringify([to, cc, bcc, subject, body, attachmentPaths, kept]);
}

export function ComposeWindow() {
  const defaults = useComposeStore((state) => state.defaults);
  const close = useComposeStore((state) => state.close);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.show);
  const dismissToast = useToastStore((state) => state.dismiss);
  const [to, setTo] = useState(defaults.to ?? "");
  const [showCcBcc, setShowCcBcc] = useState(Boolean(defaults.cc || defaults.bcc));
  const [cc, setCc] = useState(defaults.cc ?? "");
  const [bcc, setBcc] = useState(defaults.bcc ?? "");
  const [subject, setSubject] = useState(defaults.subject ?? "");
  const [body, setBody] = useState(defaults.body ?? "");
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>(defaults.attachmentPaths ?? []);
  const [keptAttachments, setKeptAttachments] = useState<KeptAttachment[]>(
    defaults.keptAttachments ?? [],
  );
  const [draftId, setDraftId] = useState(defaults.draftId);
  const addresses = useAddresses();
  const primary = primaryAddress(addresses);
  const [fromMailboxId, setFromMailboxId] = useState(defaults.fromMailboxId ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const latest = useRef<ComposeDefaults>({});
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(() =>
    defaultScheduleTime(defaults.scheduledFor),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [minimumScheduleTime] = useState(() =>
    localDateTimeValue(new Date(Date.now() + 5 * 60 * 1000)),
  );
  const [savedSignature, setSavedSignature] = useState(() =>
    composeSignature({
      to: defaults.to ?? "",
      cc: defaults.cc ?? "",
      bcc: defaults.bcc ?? "",
      subject: defaults.subject ?? "",
      body: defaults.body ?? "",
      attachmentPaths: defaults.attachmentPaths ?? [],
      keptAttachments: defaults.keptAttachments ?? [],
    }),
  );

  const fromChoice =
    addresses.length === 0 || addresses.some((address) => address.id === fromMailboxId)
      ? fromMailboxId
      : (primary?.id ?? "");

  useEffect(() => {
    latest.current = {
      ...defaults,
      to,
      cc,
      bcc,
      subject,
      body,
      draftId,
      fromMailboxId: fromChoice || undefined,
      attachmentPaths,
      keptAttachments,
    };
  });

  useEffect(() => {
    if (!defaults.to || !bodyRef.current) return;
    bodyRef.current.focus();
    bodyRef.current.setSelectionRange(0, 0);
    bodyRef.current.scrollTop = 0;
  }, [defaults.to]);

  useEffect(
    () => () => {
      const compose = useComposeStore.getState();
      if (compose.isOpen) useComposeStore.setState({ defaults: latest.current });
    },
    [],
  );

  function refreshMailQueries(changedId?: string) {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["folders"] });
    if (changedId) queryClient.invalidateQueries({ queryKey: ["email", changedId] });
  }

  function retireDraft(id: string | undefined) {
    if (!id) return;
    const mail = useMailStore.getState();
    if (mail.selectedEmailId === id) mail.openEmail(null);
    queryClient.removeQueries({ queryKey: ["email", id] });
  }

  async function addAttachments() {
    try {
      const paths = await pickAttachments();
      if (paths.length === 0) return;
      const room = MAX_ATTACHMENTS - keptAttachments.length;
      setAttachmentPaths((current) => {
        const next = [...new Set([...current, ...paths])];
        if (next.length > room) {
          showToast(`A message can include up to ${MAX_ATTACHMENTS} attachments.`);
          return next.slice(0, Math.max(0, room));
        }
        return next;
      });
    } catch {
      showToast("The attachment picker could not be opened.");
    }
  }

  function fields() {
    return {
      to: to.trim(),
      cc: cc.trim() || undefined,
      bcc: bcc.trim() || undefined,
      subject: subject.trim(),
      body,
      inReplyTo: defaults.inReplyTo,
      draftId,
      fromMailboxId: fromChoice && fromChoice !== primary?.id ? fromChoice : undefined,
      keepAttachmentIds: draftId
        ? JSON.stringify(keptAttachments.map((attachment) => attachment.id))
        : undefined,
    };
  }

  function currentSignature(): string {
    return composeSignature({ to, cc, bcc, subject, body, attachmentPaths, keptAttachments });
  }

  function validateRecipients(): boolean {
    const nextError = recipientValidationError(to, cc, bcc);
    setError(nextError);
    return !nextError;
  }

  function canClose(): boolean {
    if (currentSignature() === savedSignature) {
      return true;
    }
    setConfirmDiscard(true);
    return false;
  }

  async function handleSaveDraft() {
    const signature = currentSignature();
    const draftFields = fields();
    const draftAttachments = [...attachmentPaths];
    setBusy(true);
    setError(null);
    try {
      const result = await saveDraft(draftFields, draftAttachments);
      setDraftId(result.id);
      setSavedSignature(signature);
      showToast("Draft saved");
      refreshMailQueries(result.id);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not save this draft.");
    } finally {
      setBusy(false);
    }
  }

  function handleSend() {
    if (!validateRecipients()) return;
    setError(null);
    const snapshot = fields();
    const snapshotAttachments = attachmentPaths;
    const reopened = {
      ...defaults,
      ...snapshot,
      attachmentPaths: snapshotAttachments,
      keptAttachments,
    };
    close();
    let cancelQueued: () => void = () => undefined;
    const sendToastId = showToast("Sending in 5 seconds", {
      label: "Undo",
      duration: UNDO_SEND_DELAY_MS + 1000,
      onClick: () => {
        cancelQueued();
        useComposeStore.getState().open(reopened);
      },
    });
    cancelQueued = queueOutgoing({
      delayMs: UNDO_SEND_DELAY_MS,
      deliver: async () => {
        dismissToast(sendToastId);
        await sendCompose(snapshot, snapshotAttachments);
        retireDraft(snapshot.draftId);
        refreshMailQueries();
      },
      keep: async () => {
        await saveDraft(snapshot, snapshotAttachments);
      },
      onSent: () => showToast("Message sent"),
      onFailed: (cause) => {
        const failedDraft = reopened;
        const compose = useComposeStore.getState();
        const message = cause instanceof ApiError ? cause.message : "Could not send that message.";
        if (!compose.isOpen) {
          compose.open(failedDraft);
          showToast(`${message} Your message was reopened.`);
        } else {
          showToast(`${message} Your message is available to recover.`, {
            label: "Recover",
            duration: Number.POSITIVE_INFINITY,
            onClick: () => useComposeStore.getState().open(failedDraft),
          });
        }
      },
    });
  }

  async function handleSchedule() {
    if (!validateRecipients()) return;
    const date = new Date(scheduledFor);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now() + 4 * 60 * 1000) {
      setError("Choose a date and time at least five minutes from now.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await scheduleSend(
        { ...fields(), scheduledFor: date.toISOString() },
        attachmentPaths,
      );
      refreshMailQueries(result.id);
      showToast(`Scheduled for ${date.toLocaleString()}`);
      close();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not schedule that message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={composeTitle(defaults)}
      size="xl"
      onClose={close}
      onRequestClose={canClose}
      preventClose={busy}
    >
      <div className="compose-modal">
        <div className="compose-addresses">
          {addresses.length > 1 && (
            <div className="compose-address-row compose-from-row">
              <span>From</span>
              <Select
                label="Send from"
                value={fromChoice}
                onValueChange={setFromMailboxId}
                disabled={busy}
                options={addresses.map((address) => ({
                  value: address.id,
                  label: address.address,
                  description: address.type === "primary" ? "Primary address" : undefined,
                }))}
              />
            </div>
          )}
          <label className="compose-address-row">
            <span>To</span>
            <input
              type="text"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setError(null);
              }}
              placeholder="name@example.com"
              autoFocus={!defaults.to}
              disabled={busy}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowCcBcc((current) => !current)}
            >
              {showCcBcc ? "Hide Cc/Bcc" : "Cc/Bcc"}
            </button>
          </label>
          {showCcBcc && (
            <div className="compose-secondary-addresses">
              <label className="compose-address-row">
                <span>Cc</span>
                <input
                  type="text"
                  value={cc}
                  onChange={(event) => setCc(event.target.value)}
                  placeholder="Optional recipients"
                  disabled={busy}
                />
              </label>
              <label className="compose-address-row">
                <span>Bcc</span>
                <input
                  type="text"
                  value={bcc}
                  onChange={(event) => setBcc(event.target.value)}
                  placeholder="Hidden recipients"
                  disabled={busy}
                />
              </label>
            </div>
          )}
          <label className="compose-address-row compose-subject-row">
            <span>Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What is this message about?"
              disabled={busy}
            />
          </label>
        </div>
        <textarea
          ref={bodyRef}
          className="compose-editor"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write your message"
          aria-label="Message body"
          disabled={busy}
        />
        {keptAttachments.length + attachmentPaths.length > 0 && (
          <div className="compose-attachments" aria-label="Attachments">
            {keptAttachments.map((attachment) => (
              <span key={attachment.id} className="compose-attachment-chip">
                <Paperclip weight="bold" />
                <span>{attachment.fileName}</span>
                <small>{formatBytes(Number(attachment.sizeBytes))}</small>
                <IconButton
                  label={`Remove ${attachment.fileName}`}
                  icon={<X />}
                  disabled={busy}
                  onClick={() =>
                    setKeptAttachments((current) =>
                      current.filter((item) => item.id !== attachment.id),
                    )
                  }
                />
              </span>
            ))}
            {attachmentPaths.map((path) => (
              <span key={path} className="compose-attachment-chip">
                <Paperclip weight="bold" />
                <span>{fileName(path)}</span>
                <IconButton
                  label={`Remove ${fileName(path)}`}
                  icon={<X />}
                  disabled={busy}
                  onClick={() =>
                    setAttachmentPaths((current) => current.filter((item) => item !== path))
                  }
                />
              </span>
            ))}
          </div>
        )}
        {scheduleOpen && (
          <section className="compose-schedule-panel">
            <div>
              <CalendarBlank weight="duotone" />
              <div>
                <strong>Schedule this message</strong>
                <p>Your local time is converted automatically when the message is queued.</p>
              </div>
            </div>
            <label>
              <span>Send date and time</span>
              <input
                type="datetime-local"
                min={minimumScheduleTime}
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                disabled={busy}
              />
            </label>
            <div className="compose-schedule-actions">
              <Button variant="ghost" size="sm" onClick={() => setScheduleOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={busy} onClick={() => void handleSchedule()}>
                Schedule message
              </Button>
            </div>
          </section>
        )}
        {error && <div className="compose-error">{error}</div>}
        <footer className="compose-footer">
          <div className="compose-primary-actions">
            <Button
              variant="primary"
              icon={<PaperPlaneTilt weight="fill" />}
              disabled={busy}
              onClick={handleSend}
            >
              Send
            </Button>
            <Button
              variant="secondary"
              icon={<Clock />}
              disabled={busy}
              onClick={() => setScheduleOpen((current) => !current)}
            >
              Schedule
            </Button>
          </div>
          <div className="compose-utility-actions">
            <IconButton
              label="Add attachments"
              icon={<Paperclip />}
              disabled={busy}
              onClick={addAttachments}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<FloppyDisk />}
              loading={busy}
              onClick={() => void handleSaveDraft()}
            >
              Save draft
            </Button>
            <ModalClose>
              <IconButton label="Discard message" danger icon={<Trash />} disabled={busy} />
            </ModalClose>
          </div>
        </footer>
      </div>
      {confirmDiscard && (
        <ConfirmationDialog
          title="Discard this message?"
          description="Your unsaved changes and selected attachments will be removed."
          confirmLabel="Discard message"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={close}
          detail="This cannot be undone unless you saved the message as a draft."
        />
      )}
    </Modal>
  );
}
