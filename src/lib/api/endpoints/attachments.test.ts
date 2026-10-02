import { beforeEach, describe, expect, it, vi } from "vitest";
import * as openpgp from "openpgp";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { downloadAttachmentToDisk, stageAttachments } from "./attachments";

async function keyPair() {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: "ecc",
    curve: "curve25519Legacy",
    userIDs: [{ email: "a@example.com" }],
    format: "armored",
  });
  return { privateKey, publicKey };
}

async function seal(publicKey: string, bytes: Uint8Array): Promise<Uint8Array> {
  const message = await openpgp.createMessage({ binary: bytes });
  const key = await openpgp.readKey({ armoredKey: publicKey });
  return (await openpgp.encrypt({
    message,
    encryptionKeys: key,
    format: "binary",
  })) as Uint8Array;
}

describe("downloadAttachmentToDisk", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("streams a plain attachment straight to disk through the native command", async () => {
    invoke.mockResolvedValueOnce("C:\\Users\\me\\Downloads\\a.txt");
    const path = await downloadAttachmentToDisk({ id: "att-1", fileName: "a.txt" }, null);
    expect(path).toBe("C:\\Users\\me\\Downloads\\a.txt");
    expect(invoke).toHaveBeenCalledWith("download_attachment", {
      attachmentId: "att-1",
      fileName: "a.txt",
    });
  });

  it("decrypts a sealed attachment in memory and saves only the plaintext", async () => {
    const { privateKey, publicKey } = await keyPair();
    const plaintext = new TextEncoder().encode("confidential contract terms");
    const sealed = await seal(publicKey, plaintext);
    invoke.mockImplementation(async (command: string, body?: unknown) => {
      if (command === "fetch_sealed_attachment") return sealed.buffer.slice(0);
      if (command === "save_attachment_bytes") {
        expect(Array.from(body as Uint8Array)).toEqual(Array.from(plaintext));
        return "C:\\Users\\me\\Downloads\\contract.pdf";
      }
      throw new Error(`unexpected command ${command}`);
    });

    const path = await downloadAttachmentToDisk(
      { id: "att-2", fileName: "Q3 contract é.pdf", encrypted: true },
      privateKey,
    );

    expect(path).toBe("C:\\Users\\me\\Downloads\\contract.pdf");
    const save = invoke.mock.calls.find(([command]) => command === "save_attachment_bytes");
    expect(save?.[2]).toEqual({
      headers: { "x-file-name": encodeURIComponent("Q3 contract é.pdf") },
    });
  });

  it("asks the user to unlock instead of downloading a sealed attachment without a key", async () => {
    await expect(
      downloadAttachmentToDisk({ id: "att-3", fileName: "x.bin", encrypted: true }, null),
    ).rejects.toMatchObject({ code: "KEY_LOCKED" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("refuses to save anything when the key cannot decrypt the attachment", async () => {
    const owner = await keyPair();
    const stranger = await keyPair();
    const sealed = await seal(owner.publicKey, new TextEncoder().encode("secret"));
    invoke.mockResolvedValueOnce(sealed.buffer.slice(0));

    await expect(
      downloadAttachmentToDisk(
        { id: "att-4", fileName: "x.bin", encrypted: true },
        stranger.privateKey,
      ),
    ).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("stageAttachments", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("stages plain and sealed attachments as files the compose window may resend", async () => {
    const { privateKey, publicKey } = await keyPair();
    const plaintext = new TextEncoder().encode("draft appendix");
    const sealed = await seal(publicKey, plaintext);
    invoke.mockImplementation(async (command: string, body?: unknown) => {
      if (command === "stage_attachment") return "/cache/staged/a/plan.txt";
      if (command === "fetch_sealed_attachment") return sealed.buffer.slice(0);
      if (command === "stage_attachment_bytes") {
        expect(Array.from(body as Uint8Array)).toEqual(Array.from(plaintext));
        return "/cache/staged/b/appendix.pdf";
      }
      throw new Error(`unexpected command ${command}`);
    });

    const paths = await stageAttachments(
      [
        { id: "att-1", fileName: "plan.txt" },
        { id: "att-2", fileName: "appendix.pdf", encrypted: true },
      ],
      privateKey,
    );

    expect(paths).toEqual(["/cache/staged/a/plan.txt", "/cache/staged/b/appendix.pdf"]);
    expect(invoke).toHaveBeenCalledWith("stage_attachment", {
      attachmentId: "att-1",
      fileName: "plan.txt",
    });
    expect(invoke.mock.calls.some(([command]) => command === "save_attachment_bytes")).toBe(false);
  });
});
