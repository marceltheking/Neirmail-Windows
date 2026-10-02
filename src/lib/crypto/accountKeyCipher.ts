const PBKDF2_SALT = new TextEncoder().encode("neir.io-pgp-key-derivation-v1");
const PBKDF2_ITERATIONS = 200000;

async function deriveAesKey(accountKey: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(accountKey),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: PBKDF2_SALT, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptPrivateKey(
  accountKey: string,
  armoredPrivateKey: string,
): Promise<string> {
  const aesKey = await deriveAesKey(accountKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(armoredPrivateKey);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, plaintext);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptPrivateKey(accountKey: string, encrypted: string): Promise<string> {
  const [ivB64, ciphertextB64] = encrypted.split(".");
  const aesKey = await deriveAesKey(accountKey);
  const iv = base64ToBytes(ivB64);
  const ciphertext = base64ToBytes(ciphertextB64);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext);
  return new TextDecoder().decode(plaintext);
}
