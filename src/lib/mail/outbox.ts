interface OutgoingMessage {
  timer: ReturnType<typeof setTimeout>;
  deliver: () => Promise<void>;
  keep: () => Promise<void>;
}

interface QueueOptions {
  delayMs: number;
  deliver: () => Promise<void>;
  keep: () => Promise<void>;
  onSent: () => void;
  onFailed: (cause: unknown) => void;
}

const queued = new Map<number, OutgoingMessage>();
const sending = new Set<Promise<void>>();
let nextId = 0;

function track(operation: Promise<void>): Promise<void> {
  sending.add(operation);
  void operation.finally(() => sending.delete(operation));
  return operation;
}

export function queueOutgoing({ delayMs, deliver, keep, onSent, onFailed }: QueueOptions) {
  const id = ++nextId;
  const timer = setTimeout(() => {
    queued.delete(id);
    void track(
      deliver().then(
        () => onSent(),
        (cause: unknown) => onFailed(cause),
      ),
    );
  }, delayMs);
  queued.set(id, { timer, deliver, keep });

  return () => {
    clearTimeout(timer);
    queued.delete(id);
  };
}

export function outgoingCount(): number {
  return queued.size + sending.size;
}

export async function flushOutgoing(): Promise<void> {
  const entries = [...queued.values()];
  queued.clear();
  const pending = [...sending];
  await Promise.all([
    ...pending,
    ...entries.map(({ timer, deliver, keep }) => {
      clearTimeout(timer);
      return track(
        deliver().catch(async () => {
          await keep().catch(() => undefined);
        }),
      );
    }),
  ]);
}
