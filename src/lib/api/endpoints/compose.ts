import { callCommand } from "../client";
import type { ComposeFields } from "../types";

export function sendCompose(
  fields: ComposeFields,
  attachmentPaths: string[],
): Promise<{ id: string }> {
  return callCommand("send_compose", { fields, attachmentPaths });
}

export function saveDraft(
  fields: ComposeFields,
  attachmentPaths: string[],
): Promise<{ id: string; created: boolean }> {
  return callCommand("save_draft", { fields, attachmentPaths });
}

export function scheduleSend(
  fields: ComposeFields,
  attachmentPaths: string[],
): Promise<{ id: string }> {
  return callCommand("schedule_send", { fields, attachmentPaths });
}

export function pickAttachments(): Promise<string[]> {
  return callCommand<string[]>("pick_attachments");
}

export function pickHtmlFile(): Promise<string | null> {
  return callCommand<string | null>("pick_html_file");
}
