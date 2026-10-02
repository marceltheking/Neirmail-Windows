import { beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => core);

import { apiRequest, setSessionLostHandler } from "./client";

const unauthorized = { status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials." };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("apiRequest session expiry", () => {
  it("reports a lost session only after /auth/me confirms it", async () => {
    const lost = vi.fn();
    setSessionLostHandler(lost);
    core.invoke.mockImplementation(() => Promise.reject(unauthorized));
    await expect(apiRequest("GET", "/webmail/folders")).rejects.toMatchObject({ status: 401 });
    await vi.waitFor(() => expect(lost).toHaveBeenCalledTimes(1));
    expect(core.invoke).toHaveBeenCalledWith("me");
  });

  it("keeps the session when a 401 was only a rejected action", async () => {
    const lost = vi.fn();
    setSessionLostHandler(lost);
    core.invoke.mockImplementation((name: string) =>
      name === "me" ? Promise.resolve({}) : Promise.reject(unauthorized),
    );
    await expect(apiRequest("POST", "/settings/2fa/disable")).rejects.toMatchObject({
      status: 401,
    });
    await vi.waitFor(() => expect(core.invoke).toHaveBeenCalledWith("me"));
    expect(lost).not.toHaveBeenCalled();
  });

  it("ignores other failures", async () => {
    const lost = vi.fn();
    setSessionLostHandler(lost);
    core.invoke.mockRejectedValue({ status: 500, message: "boom" });
    await expect(apiRequest("GET", "/x")).rejects.toMatchObject({ status: 500 });
    expect(core.invoke).toHaveBeenCalledTimes(1);
    expect(lost).not.toHaveBeenCalled();
  });
});
