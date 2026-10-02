interface KeySessionEntry {
  userId: string;
  privateKey: string;
}

let current: KeySessionEntry | null = null;

export function storeKeySession(userId: string, armoredPrivateKey: string): boolean {
  if (!userId || !armoredPrivateKey.startsWith("-----BEGIN PGP PRIVATE KEY BLOCK-----")) {
    return false;
  }
  current = { userId, privateKey: armoredPrivateKey };
  return true;
}

export function getKeySession(userId: string): string | null {
  if (!current || current.userId !== userId) return null;
  return current.privateKey;
}

export function clearKeySession(): void {
  current = null;
}
