export interface GeneratedKeyPair {
  privateKey: string;
  publicKey: string;
}

export async function generatePgpKeyPair(name?: string): Promise<GeneratedKeyPair> {
  const openpgp = await import("openpgp");
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: "rsa",
    rsaBits: 4096,
    userIDs: [{ name: name || "Neir.io User" }],
    format: "armored",
  });
  return { privateKey, publicKey };
}
