export async function decryptArmoredMessage(
  privateKeyArmored: string,
  armoredMessage: string,
): Promise<string> {
  const openpgp = await import("openpgp");
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const message = await openpgp.readMessage({ armoredMessage });
  const { data } = await openpgp.decrypt({ message, decryptionKeys: privateKey });
  return data as string;
}

export async function decryptBinaryMessage(
  privateKeyArmored: string,
  sealed: Uint8Array,
): Promise<Uint8Array> {
  const openpgp = await import("openpgp");
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const message = await openpgp.readMessage({ binaryMessage: sealed });
  const { data } = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey,
    format: "binary",
  });
  return data as Uint8Array;
}
