import { describe, expect, it } from "vitest";
import { decryptPrivateKey, encryptPrivateKey } from "./accountKeyCipher";

describe("account key encryption", () => {
  it("round-trips an armored private key", async () => {
    const key = "ABCD1234EFGH5678";
    const privateKey =
      "-----BEGIN PGP PRIVATE KEY BLOCK-----\nfixture\n-----END PGP PRIVATE KEY BLOCK-----";
    const encrypted = await encryptPrivateKey(key, privateKey);
    expect(encrypted).not.toContain("fixture");
    await expect(decryptPrivateKey(key, encrypted)).resolves.toBe(privateKey);
  });

  it("rejects a different account key", async () => {
    const encrypted = await encryptPrivateKey("ABCD1234EFGH5678", "private material");
    await expect(decryptPrivateKey("ZZZZ1234EFGH5678", encrypted)).rejects.toThrow();
  });
});
