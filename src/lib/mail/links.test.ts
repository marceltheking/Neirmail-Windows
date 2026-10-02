import { beforeEach, describe, expect, it, vi } from "vitest";

const opener = vi.hoisted(() => ({ openUrl: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => opener);
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

import { queryClient } from "../queryClient";
import { useComposeStore } from "../state/composeStore";
import { openEmailLink } from "./links";

beforeEach(() => {
  opener.openUrl.mockReset().mockResolvedValue(undefined);
  queryClient.clear();
  useComposeStore.getState().close();
});

describe("openEmailLink", () => {
  it("opens web links in the browser without tracking parameters", () => {
    openEmailLink("https://shop.example/item?id=7&utm_source=mail");
    expect(opener.openUrl).toHaveBeenCalledWith("https://shop.example/item?id=7");
  });

  it("keeps tracking parameters when the user turned cleaning off", () => {
    queryClient.setQueryData(["preferences"], { stripTrackingParamsEnabled: false });
    openEmailLink("https://shop.example/item?utm_source=mail");
    expect(opener.openUrl).toHaveBeenCalledWith("https://shop.example/item?utm_source=mail");
  });

  it("turns mailto links into a new message", () => {
    openEmailLink("mailto:ada@example.com?subject=Hi");
    expect(useComposeStore.getState()).toMatchObject({
      isOpen: true,
      defaults: { to: "ada@example.com", subject: "Hi" },
    });
    expect(opener.openUrl).not.toHaveBeenCalled();
  });

  it("ignores every other scheme", () => {
    for (const href of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "about:srcdoc#x",
      "/relative",
    ]) {
      openEmailLink(href);
    }
    expect(opener.openUrl).not.toHaveBeenCalled();
    expect(useComposeStore.getState().isOpen).toBe(false);
  });
});
