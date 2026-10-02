import { listen } from "@tauri-apps/api/event";
import { callCommand } from "../api/client";
import { flushOutgoing, outgoingCount } from "../mail/outbox";

export async function registerQuitHandler(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await listen("quit-requested", async () => {
    if (outgoingCount() > 0) await callCommand("defer_quit").catch(() => undefined);
    await flushOutgoing();
    await callCommand("quit_app").catch(() => undefined);
  });
}
