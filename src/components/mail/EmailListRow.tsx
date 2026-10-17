import { ArrowSquareOut, Clock, Eye, Paperclip, PushPin, Star } from "@phosphor-icons/react";
import type { EmailListItem } from "../../lib/api/types";
import { formatFullDate, formatListDate } from "../../lib/format/date";
import { sponsorMark, sponsoredHost } from "../../lib/mail/sponsored";
import { Checkbox } from "../ui/Checkbox";
import { SenderAvatar } from "./SenderAvatar";

interface EmailListRowProps {
  email: EmailListItem;
  selected: boolean;
  active: boolean;
  outgoing: boolean;
  showSeen: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onToggleStar: () => void;
}

export function EmailListRow({
  email,
  selected,
  active,
  outgoing,
  showSeen,
  onToggleSelect,
  onOpen,
  onToggleStar,
}: EmailListRowProps) {
  const sponsor = sponsoredHost(email);
  const mark = sponsorMark(sponsor);
  const counterpart = sponsor
    ? `ad@${sponsor}`
    : outgoing
      ? email.recipientAddress
      : email.senderAddress;
  const label = sponsor
    ? sponsor
    : outgoing
      ? `To: ${email.recipientAddress || "(no recipient)"}`
      : email.senderName || email.senderAddress;
  return (
    <article
      data-email-id={email.id}
      className={`wm-row${email.isRead || sponsor ? "" : " unread"}${active ? " active" : ""}${selected ? " selected" : ""}${email.isPinned ? " pinned" : ""}${sponsor ? " sponsored" : ""}`}
    >
      <span className="wm-row-unread" aria-hidden="true" />
      <span>
        {!email.isPinned && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            label={`Select ${email.subject || "message"}`}
          />
        )}
      </span>
      {sponsor ? (
        <span aria-hidden="true" />
      ) : (
        <button
          type="button"
          className={`wm-row-star${email.isStarred ? " on" : ""}`}
          aria-label={email.isStarred ? "Remove star" : "Star message"}
          onClick={onToggleStar}
        >
          <Star weight={email.isStarred ? "fill" : "regular"} />
        </button>
      )}
      <button
        type="button"
        className="wm-row-open"
        onClick={onOpen}
        title={sponsor ? `Opens ${sponsor} in your browser` : undefined}
      >
        {mark ? (
          <span className="wm-row-avatar wm-row-avatar-mark" aria-hidden="true">
            <img src={mark} alt="" />
          </span>
        ) : (
          <SenderAvatar
            className="wm-row-avatar"
            name={outgoing || sponsor ? null : email.senderName}
            address={counterpart}
          />
        )}
        <span className="wm-row-sender">{label}</span>
        <span className="wm-row-subject">
          {sponsor ? (
            <span className="wm-row-sponsored">Sponsored</span>
          ) : (
            email.isPinned && (
              <span className="wm-row-pin" title="Pinned">
                <PushPin weight="fill" aria-label="Pinned" />
              </span>
            )
          )}
          {email.scheduledFor && (
            <span
              className="wm-row-badge"
              title={`Scheduled for ${formatFullDate(email.scheduledFor)}`}
            >
              <Clock weight="bold" aria-hidden="true" />
              Scheduled
            </span>
          )}
          {showSeen && email.openedAt && (
            <span className="wm-row-badge" title={`Opened ${formatFullDate(email.openedAt)}`}>
              <Eye weight="bold" aria-hidden="true" />
              Seen
            </span>
          )}
          {email.subject || "No subject"}
          {email.hasAttachments && <Paperclip className="wm-row-attach" />}
        </span>
        <span className="wm-row-date">
          {sponsor ? (
            <ArrowSquareOut weight="bold" aria-label="External link" />
          ) : (
            formatListDate(email.receivedAt)
          )}
        </span>
      </button>
    </article>
  );
}
