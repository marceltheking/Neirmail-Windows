import type { EmailDetail } from "../api/types";

interface ComposeSeed {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  fromMailboxId?: string;
}

type SourceEmail = Pick<
  EmailDetail,
  | "senderName"
  | "senderAddress"
  | "recipientAddress"
  | "ccAddresses"
  | "subject"
  | "messageId"
  | "receivedAt"
  | "mailboxId"
>;

function prefixed(subject: string, prefix: "Re" | "Fwd"): string {
  const pattern = prefix === "Re" ? /^re:\s/i : /^(fwd?|fw):\s/i;
  return pattern.test(subject) ? subject : `${prefix}: ${subject}`;
}

function senderLabel(email: SourceEmail): string {
  return email.senderName || email.senderAddress;
}

function quoted(email: SourceEmail, text: string): string {
  const lines = text.split("\n").map((line) => `> ${line}`);
  return `\n\n---\nOn ${new Date(email.receivedAt).toLocaleString()}, ${senderLabel(email)} wrote:\n\n${lines.join("\n")}`;
}

export function buildReply(email: SourceEmail, text: string, outgoing: boolean): ComposeSeed {
  return {
    to: outgoing ? email.recipientAddress : email.senderAddress,
    subject: prefixed(email.subject, "Re"),
    body: quoted(email, text),
    inReplyTo: email.messageId,
    fromMailboxId: email.mailboxId,
  };
}

export function buildReplyAll(
  email: SourceEmail,
  text: string,
  ownAddresses: string[],
): ComposeSeed {
  const own = new Set(ownAddresses.map((address) => address.toLowerCase()));
  const sender = email.senderAddress.toLowerCase();
  const others = [email.recipientAddress, ...email.ccAddresses].filter((address) => {
    const lower = address.toLowerCase();
    return lower && lower !== sender && !own.has(lower);
  });
  return {
    to: email.senderAddress,
    cc: [...new Set(others)].join(", ") || undefined,
    subject: prefixed(email.subject, "Re"),
    body: quoted(email, text),
    inReplyTo: email.messageId,
    fromMailboxId: email.mailboxId,
  };
}

export function buildForward(email: SourceEmail, text: string): ComposeSeed {
  const from = email.senderName
    ? `${email.senderName} <${email.senderAddress}>`
    : `<${email.senderAddress}>`;
  return {
    to: "",
    subject: prefixed(email.subject, "Fwd"),
    body: `\n\n--- Forwarded message ---\nFrom: ${from}\nDate: ${new Date(email.receivedAt).toLocaleString()}\nSubject: ${email.subject}\n\n${text}`,
    fromMailboxId: email.mailboxId,
  };
}

export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, head").forEach((node) => node.remove());
  doc.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  doc.querySelectorAll("p, div, li, tr, h1, h2, h3, h4").forEach((node) => node.append("\n"));
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
