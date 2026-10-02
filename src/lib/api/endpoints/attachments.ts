import { callBinaryCommand, callCommand, callCommandWithBody } from "../client";
import { decryptBinaryMessage } from "../../crypto/pgp";
import { ApiError } from "../types";

export interface DownloadableAttachment {
  id: string;
  fileName: string;
  encrypted?: boolean;
}

async function writePlainAttachment(
  attachment: DownloadableAttachment,
  privateKey: string | null,
  commands: { plain: string; bytes: string },
): Promise<string> {
  if (!attachment.encrypted) {
    return callCommand<string>(commands.plain, {
      attachmentId: attachment.id,
      fileName: attachment.fileName,
    }).catch((err: unknown) => {
      if (err instanceof ApiError && err.code === "ATTACHMENT_SEALED") {
        return writePlainAttachment({ ...attachment, encrypted: true }, privateKey, commands);
      }
      throw err;
    });
  }
  if (!privateKey) {
    throw new ApiError({
      status: 0,
      code: "KEY_LOCKED",
      message: "Unlock your mailbox with your Account Key to open this attachment.",
    });
  }
  const sealed = await callBinaryCommand("fetch_sealed_attachment", {
    attachmentId: attachment.id,
  });
  const plain = await decryptBinaryMessage(privateKey, sealed).catch(() => {
    throw new ApiError({
      status: 0,
      code: "DECRYPT_FAILED",
      message: "This attachment could not be decrypted with your key.",
    });
  });
  return callCommandWithBody<string>(commands.bytes, plain, {
    "x-file-name": encodeURIComponent(attachment.fileName),
  });
}

export function downloadAttachmentToDisk(
  attachment: DownloadableAttachment,
  privateKey: string | null,
): Promise<string> {
  return writePlainAttachment(attachment, privateKey, {
    plain: "download_attachment",
    bytes: "save_attachment_bytes",
  });
}

export function stageAttachments(
  attachments: DownloadableAttachment[],
  privateKey: string | null,
): Promise<string[]> {
  return Promise.all(
    attachments.map((attachment) =>
      writePlainAttachment(attachment, privateKey, {
        plain: "stage_attachment",
        bytes: "stage_attachment_bytes",
      }),
    ),
  );
}

export function clearStagedAttachments(): Promise<void> {
  return callCommand<void>("clear_staged_attachments");
}

export function fetchRemoteImage(imageUrl: string): Promise<string> {
  return callCommand<string>("fetch_remote_image", { imageUrl });
}
