import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export async function copyText(value: string): Promise<void> {
  try {
    await writeText(value);
  } catch (nativeError) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    throw nativeError;
  }
}
