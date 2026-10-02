import { invoke, type InvokeArgs } from "@tauri-apps/api/core";
import { ApiError } from "./types";

let sessionLostHandler: (() => void) | null = null;
let verifyingSession = false;

export function setSessionLostHandler(handler: (() => void) | null): void {
  sessionLostHandler = handler;
}

export function triggerSessionLost(): void {
  sessionLostHandler?.();
}

async function verifySessionLost(): Promise<void> {
  if (verifyingSession) return;
  verifyingSession = true;
  try {
    await invoke("me");
  } catch (err) {
    if (ApiError.fromUnknown(err).status === 401) sessionLostHandler?.();
  } finally {
    verifyingSession = false;
  }
}

export async function callCommand<T>(name: string, args?: InvokeArgs): Promise<T> {
  try {
    return await invoke<T>(name, args);
  } catch (err) {
    throw ApiError.fromUnknown(err);
  }
}

export async function callBinaryCommand(name: string, args?: InvokeArgs): Promise<Uint8Array> {
  try {
    return new Uint8Array(await invoke<ArrayBuffer>(name, args));
  } catch (err) {
    throw ApiError.fromUnknown(err);
  }
}

export async function callCommandWithBody<T>(
  name: string,
  body: Uint8Array,
  headers: Record<string, string>,
): Promise<T> {
  try {
    return await invoke<T>(name, body, { headers });
  } catch (err) {
    throw ApiError.fromUnknown(err);
  }
}

interface ApiRequestOptions {
  body?: unknown;
  query?: Record<string, string>;
}

export function apiRequest<T>(
  method: string,
  path: string,
  { body, query }: ApiRequestOptions = {},
): Promise<T> {
  return callCommand<T>("api_request", {
    method,
    path,
    body: body ?? null,
    query: query ?? null,
  }).catch((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) void verifySessionLost();
    throw err;
  });
}
