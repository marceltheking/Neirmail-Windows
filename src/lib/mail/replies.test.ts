// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildForward, buildReply, buildReplyAll, htmlToText } from "./replies";

const email = {
  senderName: "Mara Nilsson",
  senderAddress: "mara@example.com",
  recipientAddress: "alias@neirmail.com",
  ccAddresses: ["lin@example.com", "ME@neir.io", "mara@example.com"],
  subject: "Project notes",
  messageId: "<abc@example.com>",
  receivedAt: "2026-09-30T10:00:00Z",
  mailboxId: "mailbox-alias",
};

describe("replies", () => {
  it("replies to the sender from the address the mail arrived at, quoting the original", () => {
    const reply = buildReply(email, "Line one\nLine two", false);
    expect(reply.to).toBe("mara@example.com");
    expect(reply.subject).toBe("Re: Project notes");
    expect(reply.inReplyTo).toBe("<abc@example.com>");
    expect(reply.fromMailboxId).toBe("mailbox-alias");
    expect(reply.body).toContain("Mara Nilsson wrote:\n\n> Line one\n> Line two");
  });

  it("replies to the recipient when the original was outgoing", () => {
    expect(buildReply(email, "", true).to).toBe("alias@neirmail.com");
  });

  it("does not stack prefixes", () => {
    expect(buildReply({ ...email, subject: "RE: Project notes" }, "", false).subject).toBe(
      "RE: Project notes",
    );
    expect(buildForward({ ...email, subject: "Fwd: Project notes" }, "").subject).toBe(
      "Fwd: Project notes",
    );
    expect(buildForward({ ...email, subject: "FW: Project notes" }, "").subject).toBe(
      "FW: Project notes",
    );
  });

  it("reply all copies everyone except the sender and your own addresses", () => {
    const reply = buildReplyAll(email, "", ["me@neir.io", "alias@neirmail.com"]);
    expect(reply.to).toBe("mara@example.com");
    expect(reply.cc).toBe("lin@example.com");
  });

  it("forwards with a header block and no recipient", () => {
    const forward = buildForward(email, "Body");
    expect(forward.to).toBe("");
    expect(forward.body).toContain(
      "--- Forwarded message ---\nFrom: Mara Nilsson <mara@example.com>",
    );
    expect(forward.body).toContain("Subject: Project notes\n\nBody");
  });

  it("turns html into readable text for quoting", () => {
    expect(htmlToText("<p>Hello</p><p>World<br>again</p><script>x</script>")).toContain(
      "Hello\nWorld\nagain",
    );
  });
});
