import { create } from "zustand";
import { fetchSenderIcon, getSenderIconSources } from "../api/endpoints/senderIcons";
import type { SenderIconSource } from "../api/types";
import { chunkDomains, classifyIconPixels, type IconLook } from "../mail/senderIcon";

const MANIFEST_LIMIT = 200;
const MANIFEST_DELAY_MS = 40;
const ICON_CONCURRENCY = 4;
const NONE_RETRY_MS = 10 * 60 * 1000;
const PROBE_SIZE = 24;

export interface IconEntry {
  status: "ready" | "none";
  source?: SenderIconSource;
  url?: string;
  look?: IconLook;
  checkedAt: number;
}

interface SenderIconState {
  entries: Record<string, IconEntry>;
  request: (domain: string) => void;
  reset: () => void;
}

let generation = 0;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
const queued = new Set<string>();
const inFlight = new Set<string>();

function measureIcon(url: string): Promise<IconLook | null> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = PROBE_SIZE;
        canvas.height = PROBE_SIZE;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve({ kind: "plain" });
        context.drawImage(probe, 0, 0, PROBE_SIZE, PROBE_SIZE);
        const pixels = context.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE).data;
        resolve(classifyIconPixels(pixels, PROBE_SIZE));
      } catch {
        resolve({ kind: "plain" });
      }
    };
    probe.onerror = () => resolve(null);
    probe.src = url;
  });
}

async function loadIcon(domain: string): Promise<{ url: string; look: IconLook } | null> {
  try {
    const url = await fetchSenderIcon(domain);
    const look = await measureIcon(url);
    return look ? { url, look } : null;
  } catch {
    return null;
  }
}

export const useSenderIconStore = create<SenderIconState>((set, get) => {
  function settle(round: number, domain: string, entry: Omit<IconEntry, "checkedAt">) {
    if (round !== generation) return;
    inFlight.delete(domain);
    set((state) => ({
      entries: { ...state.entries, [domain]: { ...entry, checkedAt: Date.now() } },
    }));
  }

  async function resolveBatch(round: number, domains: string[]) {
    let sources: Record<string, SenderIconSource> = {};
    try {
      sources = await getSenderIconSources(domains);
    } catch {
      domains.forEach((domain) => settle(round, domain, { status: "none" }));
      return;
    }

    const withIcon = domains.filter((domain) => sources[domain]);
    domains
      .filter((domain) => !sources[domain])
      .forEach((domain) => settle(round, domain, { status: "none" }));

    let next = 0;
    const worker = async () => {
      while (next < withIcon.length) {
        const domain = withIcon[next++];
        const icon = await loadIcon(domain);
        if (icon) settle(round, domain, { status: "ready", source: sources[domain], ...icon });
        else settle(round, domain, { status: "none" });
      }
    };
    await Promise.all(Array.from({ length: ICON_CONCURRENCY }, worker));
  }

  function flush() {
    flushTimer = undefined;
    const round = generation;
    const domains = [...queued];
    queued.clear();
    for (const batch of chunkDomains(domains, MANIFEST_LIMIT)) {
      void resolveBatch(round, batch);
    }
  }

  return {
    entries: {},
    request: (domain) => {
      if (!domain || queued.has(domain) || inFlight.has(domain)) return;
      const existing = get().entries[domain];
      if (
        existing &&
        (existing.status === "ready" || Date.now() - existing.checkedAt < NONE_RETRY_MS)
      ) {
        return;
      }
      inFlight.add(domain);
      queued.add(domain);
      flushTimer ??= setTimeout(flush, MANIFEST_DELAY_MS);
    },
    reset: () => {
      generation += 1;
      clearTimeout(flushTimer);
      flushTimer = undefined;
      queued.clear();
      inFlight.clear();
      set({ entries: {} });
    },
  };
});
