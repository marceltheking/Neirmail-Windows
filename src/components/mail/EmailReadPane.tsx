import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArchiveBoxIcon,
  ArrowLeft,
  DownloadSimple,
  Paperclip,
  Star,
  Trash,
  Warning,
  ArrowBendUpLeft,
  ArrowBendDoubleUpLeft,
  ArrowBendUpRight,
  ClockCounterClockwise,
  PenNib,
} from "@phosphor-icons/react";
import { getEmail, batchAction, unsubscribe, unscheduleSend } from "../../lib/api/endpoints/emails";
import { markListedAsRead } from "../../lib/mail/readState";
import { buildUndo } from "../../lib/mail/undo";
import { downloadAttachmentToDisk, stageAttachments } from "../../lib/api/endpoints/attachments";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { ApiError } from "../../lib/api/types";
import { decryptArmoredMessage } from "../../lib/crypto/pgp";
import { getKeySession } from "../../lib/crypto/keySession";
import { useAuthStore } from "../../lib/state/authStore";
import { useComposeStore } from "../../lib/state/composeStore";
import { useMailStore } from "../../lib/state/mailStore";
import { useToastStore } from "../../lib/state/toastStore";
import { formatFullDate } from "../../lib/format/date";
import { formatBytes } from "../../lib/format/bytes";
import { useAddresses } from "../../lib/hooks/useAddresses";
import { useShortcuts } from "../../lib/hooks/useShortcuts";
import { buildForward, buildReply, buildReplyAll, htmlToText } from "../../lib/mail/replies";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { ErrorState, Skeleton } from "../ui/States";
import { EmailHtmlBody } from "./EmailHtmlBody";
import { SenderAvatar } from "./SenderAvatar";

interface DecryptedMessage {
  source: string;
  text: string;
  html: string | null;
  error: string | null;
}

export function EmailReadPane({ emailId }: { emailId: string }) {
  const openEmail = useMailStore((state) => state.openEmail);
  const navKind = useMailStore((state) => state.nav.kind);
  const me = useAuthStore((state) => state.me);
  const openCompose = useComposeStore((state) => state.open);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.show);
  const [decrypted, setDecrypted] = useState<Record<string, DecryptedMessage>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const addresses = useAddresses();

  const {
    data: email,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["email", emailId],
    queryFn: () => getEmail(emailId),
  });
  const privateKey = me ? getKeySession(me.userId) : null;
  const openedId = email?.id;

  useEffect(() => {
    if (!openedId) return;
    if (markListedAsRead(queryClient, openedId)) {
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  }, [openedId, queryClient]);

  useEffect(() => {
    if (!email || !privateKey || decrypted[email.id]?.source === email.encryptedBody) return;
    let cancelled = false;
    Promise.all([
      decryptArmoredMessage(privateKey, email.encryptedBody),
      email.encryptedHtmlBody
        ? decryptArmoredMessage(privateKey, email.encryptedHtmlBody).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([text, html]) => {
        if (!cancelled)
          setDecrypted((current) => ({
            ...current,
            [email.id]: { source: email.encryptedBody, text, html, error: null },
          }));
      })
      .catch(() => {
        if (!cancelled)
          setDecrypted((current) => ({
            ...current,
            [email.id]: {
              source: email.encryptedBody,
              text: "",
              html: null,
              error: "This message could not be decrypted.",
            },
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [email, privateKey, decrypted]);

  const cached = email ? decrypted[email.id] : undefined;
  const result = cached && cached.source === email?.encryptedBody ? cached : undefined;
  const decryptError = !privateKey
    ? "Your mailbox is locked. Log in again to read this message."
    : result?.error;

  const mutation = useMutation({
    mutationFn: ({
      action,
    }: {
      action: "star" | "unstar" | "archive" | "unarchive" | "trash" | "unread";
    }) => batchAction([emailId], action),
    onSuccess: (results, variables) => {
      queryClient.invalidateQueries({ queryKey: ["email", emailId] });
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      if (variables.action === "trash" || variables.action === "unread") openEmail(null);
      if (variables.action === "unread") showToast("Marked unread");
      if (variables.action === "trash" || variables.action === "archive") {
        const undo = buildUndo(results);
        showToast(variables.action === "trash" ? "Trashed" : "Archived", {
          label: "Undo",
          onClick: () =>
            undo()
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ["emails"] });
                queryClient.invalidateQueries({ queryKey: ["folders"] });
              })
              .catch(() => showToast("Could not undo that action.")),
        });
      }
    },
    onError: () => showToast("That action could not be completed."),
  });
  const unsubscribeMutation = useMutation({
    mutationFn: () => unsubscribe(emailId),
    onSuccess: () => showToast("Unsubscribe request sent"),
    onError: (cause) =>
      showToast(cause instanceof ApiError ? cause.message : "Could not unsubscribe."),
  });
  const unscheduleMutation = useMutation({
    mutationFn: () => unscheduleSend(emailId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      showToast("Scheduled send cancelled");
      openEmail(null);
    },
    onError: (cause) =>
      showToast(cause instanceof ApiError ? cause.message : "Could not cancel the scheduled send."),
  });

  const isDraft = navKind === "drafts" || Boolean(email?.scheduledFor);
  const isOutgoing = isDraft || navKind === "sent";
  const quoteText = result ? result.text || (result.html ? htmlToText(result.html) : "") : "";
  const replyAllSeed =
    email && !isOutgoing
      ? buildReplyAll(
          email,
          quoteText,
          addresses.map((address) => address.address),
        )
      : null;
  const canReplyAll = Boolean(replyAllSeed?.cc);

  function reply() {
    if (!email || isDraft) return;
    openCompose({ kind: "reply", ...buildReply(email, quoteText, isOutgoing) });
  }

  function replyAll() {
    if (!replyAllSeed || !canReplyAll) return;
    openCompose({ kind: "reply", ...replyAllSeed });
  }

  async function forward() {
    if (!email || isDraft || preparing) return;
    const seed = buildForward(email, quoteText);
    if (email.attachments.length === 0) {
      openCompose({ kind: "forward", ...seed });
      return;
    }
    setPreparing(true);
    try {
      const attachmentPaths = await stageAttachments(email.attachments, privateKey);
      openCompose({ kind: "forward", ...seed, attachmentPaths });
    } catch (cause) {
      openCompose({ kind: "forward", ...seed });
      showToast(
        `${cause instanceof ApiError ? cause.message : "The attachments could not be prepared."} The message was opened without them.`,
      );
    } finally {
      setPreparing(false);
    }
  }

  async function editDraft() {
    if (!email || !result || preparing) return;
    setPreparing(true);
    try {
      const sealed = email.attachments.filter((attachment) => attachment.encrypted);
      const attachmentPaths = await stageAttachments(sealed, privateKey);
      openCompose({
        kind: "draft",
        to: email.recipientAddress,
        cc: email.ccAddresses.join(", "),
        bcc: email.bccAddresses.join(", "),
        subject: email.subject,
        body: result.text || (result.html ? htmlToText(result.html) : ""),
        inReplyTo: email.inReplyTo ?? undefined,
        draftId: email.id,
        fromMailboxId: email.mailboxId,
        scheduledFor: email.scheduledFor ?? undefined,
        keptAttachments: email.attachments
          .filter((attachment) => !attachment.encrypted)
          .map(({ id, fileName, sizeBytes }) => ({ id, fileName, sizeBytes })),
        attachmentPaths,
      });
    } catch (cause) {
      showToast(
        cause instanceof ApiError
          ? `${cause.message} The draft was left unchanged.`
          : "This draft could not be opened for editing. It was left unchanged.",
      );
    } finally {
      setPreparing(false);
    }
  }

  useShortcuts(
    {
      r: reply,
      a: replyAll,
      f: () => void forward(),
      e: () => email && mutation.mutate({ action: email.isArchived ? "unarchive" : "archive" }),
      "#": () => email && mutation.mutate({ action: "trash" }),
      Delete: () => email && mutation.mutate({ action: "trash" }),
      s: () => email && mutation.mutate({ action: email.isStarred ? "unstar" : "star" }),
      u: () => email && !isOutgoing && mutation.mutate({ action: "unread" }),
      Escape: () => openEmail(null),
    },
    { enabled: Boolean(email) },
  );

  if (isLoading) return <Skeleton lines={7} />;
  if (isError || !email) {
    return (
      <ErrorState
        title="Message could not be opened"
        description={
          error instanceof ApiError
            ? error.message
            : "The message may be unavailable while you are offline."
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const correspondentName = isOutgoing
    ? email.recipientAddress
    : email.senderName || email.senderAddress;
  const correspondentAddress = isOutgoing ? email.recipientAddress : email.senderAddress;

  return (
    <article className="wm-read">
      <div className="wm-read-top">
        <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => openEmail(null)}>
          Back
        </Button>
        <div className="wm-read-actions">
          <IconButton
            label={email.isStarred ? "Remove star" : "Star"}
            active={email.isStarred}
            icon={<Star weight={email.isStarred ? "fill" : "regular"} />}
            onClick={() => mutation.mutate({ action: email.isStarred ? "unstar" : "star" })}
          />
          <IconButton
            label={email.isArchived ? "Unarchive" : "Archive"}
            icon={<ArchiveBoxIcon />}
            onClick={() => mutation.mutate({ action: email.isArchived ? "unarchive" : "archive" })}
          />
          <IconButton
            danger
            label="Move to trash"
            icon={<Trash />}
            onClick={() => mutation.mutate({ action: "trash" })}
          />
        </div>
      </div>
      <div className="wm-read-scroll">
        <div className="wm-read-body">
          {(email.lookalikeDomainWarning || email.isFirstTimeSender) && (
            <div className="mail-security-warning">
              <Warning weight="fill" />
              <div>
                <strong>
                  {email.lookalikeDomainWarning
                    ? "Check this sender carefully"
                    : "First message from this sender"}
                </strong>
                <span>
                  {email.lookalikeDomainWarning ||
                    "Neir has not seen this address in your mailbox before."}
                </span>
              </div>
            </div>
          )}
          {email.scheduledFor && (
            <div className="mail-delivery-note">
              <ClockCounterClockwise weight="duotone" />
              <div>
                <strong>Scheduled to send</strong>
                <span>{formatFullDate(email.scheduledFor)}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={unscheduleMutation.isPending}
                onClick={() => unscheduleMutation.mutate()}
              >
                Cancel send
              </Button>
            </div>
          )}
          {email.deliveryError && (
            <div className="mail-security-warning" role="alert">
              <Warning weight="fill" />
              <div>
                <strong>Delivery needs attention</strong>
                <span>{email.deliveryError}</span>
              </div>
            </div>
          )}
          <h1 className="wm-read-subject">{email.subject || "No subject"}</h1>
          <div className="wm-read-sender-card">
            <SenderAvatar
              className="wm-read-avatar"
              name={isOutgoing ? null : email.senderName}
              address={correspondentAddress}
            />
            <div className="wm-read-meta-copy">
              <div>
                <strong>{correspondentName}</strong>
                {!isOutgoing && email.senderName && <span>&lt;{correspondentAddress}&gt;</span>}
              </div>
              <span>
                {isOutgoing ? `From ${email.senderAddress}` : `To ${email.recipientAddress}`}
                {email.ccAddresses.length ? ` · Cc ${email.ccAddresses.join(", ")}` : ""}
                {email.bccAddresses.length ? ` · Bcc ${email.bccAddresses.join(", ")}` : ""}
              </span>
            </div>
            <time>{formatFullDate(email.receivedAt)}</time>
            {isDraft ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<PenNib />}
                loading={preparing}
                disabled={!result || Boolean(decryptError)}
                onClick={() => void editDraft()}
              >
                Edit draft
              </Button>
            ) : (
              <div className="wm-read-reply-icons">
                <IconButton label="Reply (R)" icon={<ArrowBendUpLeft />} onClick={reply} />
                {canReplyAll && (
                  <IconButton
                    label="Reply all (A)"
                    icon={<ArrowBendDoubleUpLeft />}
                    onClick={replyAll}
                  />
                )}
                <IconButton
                  label="Forward (F)"
                  icon={<ArrowBendUpRight />}
                  disabled={preparing}
                  onClick={() => void forward()}
                />
              </div>
            )}
          </div>

          {decryptError && <div className="wm-read-error">{decryptError}</div>}
          {!decryptError && !result && <Skeleton lines={4} />}
          {result?.html ? (
            <EmailHtmlBody html={result.html} />
          ) : result?.text ? (
            <pre className="wm-read-text">{result.text}</pre>
          ) : null}

          {email.unsubscribeUrl && (
            <div className="mail-unsubscribe">
              <span>This message includes a mailing-list unsubscribe option.</span>
              <Button
                variant="ghost"
                size="sm"
                loading={unsubscribeMutation.isPending}
                onClick={() => unsubscribeMutation.mutate()}
              >
                Unsubscribe
              </Button>
            </div>
          )}

          {email.attachments.length > 0 && (
            <section className="wm-attachments">
              <h2>
                <Paperclip />
                Attachments
              </h2>
              <div className="wm-attachment-grid">
                {email.attachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    className="wm-attachment-chip"
                    disabled={downloadingId === attachment.id}
                    aria-busy={downloadingId === attachment.id || undefined}
                    onClick={async () => {
                      setDownloadingId(attachment.id);
                      try {
                        const path = await downloadAttachmentToDisk(attachment, privateKey);
                        showToast("Downloaded", {
                          label: "Show in folder",
                          onClick: () =>
                            void revealItemInDir(path).catch(() =>
                              showToast("Could not reveal the download."),
                            ),
                        });
                      } catch (err) {
                        showToast(
                          err instanceof ApiError
                            ? err.message
                            : "Could not download that attachment.",
                        );
                      } finally {
                        setDownloadingId(null);
                      }
                    }}
                  >
                    <span className="wm-attachment-icon">
                      <DownloadSimple />
                    </span>
                    <span>
                      <strong>{attachment.fileName}</strong>
                      <small>
                        {downloadingId === attachment.id
                          ? "Downloading…"
                          : formatBytes(Number(attachment.sizeBytes))}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {!isDraft && (
            <div className="wm-reply-bar">
              <Button variant="secondary" icon={<ArrowBendUpLeft />} onClick={reply}>
                Reply
              </Button>
              {canReplyAll && (
                <Button variant="secondary" icon={<ArrowBendDoubleUpLeft />} onClick={replyAll}>
                  Reply all
                </Button>
              )}
              <Button
                variant="secondary"
                icon={<ArrowBendUpRight />}
                loading={preparing}
                onClick={() => void forward()}
              >
                Forward
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
