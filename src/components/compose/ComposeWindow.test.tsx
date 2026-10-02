// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComposeStore } from "../../lib/state/composeStore";
import { ComposeWindow } from "./ComposeWindow";

vi.mock("../../lib/api/endpoints/dashboard", () => ({
  listAddresses: () =>
    Promise.resolve([
      {
        id: "primary",
        address: "me@neir.io",
        type: "primary",
        catchAll: false,
        isRandomAlias: false,
        createdAt: "",
      },
      {
        id: "alias",
        address: "alias@neirmail.com",
        type: "alias",
        catchAll: false,
        isRandomAlias: false,
        createdAt: "",
      },
    ]),
}));

const compose = vi.hoisted(() => ({
  scheduleSend: vi.fn(),
  saveDraft: vi.fn(),
  sendCompose: vi.fn(),
  pickAttachments: vi.fn(),
}));

vi.mock("../../lib/api/endpoints/compose", () => ({
  scheduleSend: compose.scheduleSend,
  saveDraft: compose.saveDraft,
  sendCompose: compose.sendCompose,
  pickAttachments: compose.pickAttachments,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useComposeStore.getState().close();
});

function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

async function renderCompose() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <TooltipPrimitive.Provider>
          <ComposeWindow />
        </TooltipPrimitive.Provider>
      </QueryClientProvider>,
    );
  });
}

describe("ComposeWindow", () => {
  it("keeps the reply alias even before the address list has loaded", async () => {
    useComposeStore.getState().open({ kind: "reply", to: "a@example.com", fromMailboxId: "alias" });
    await renderCompose();
    act(() => root.unmount());
    root = createRoot(host);
    expect(useComposeStore.getState().defaults.fromMailboxId).toBe("alias");
  });

  it("keeps unsent text when the app locks while it is open", async () => {
    useComposeStore
      .getState()
      .open({ kind: "reply", to: "a@example.com", subject: "Re: hi", inReplyTo: "<m>" });
    await renderCompose();
    const editor = document.querySelector<HTMLTextAreaElement>(".compose-editor")!;
    act(() => type(editor, "Half written reply"));
    act(() => root.unmount());
    root = createRoot(host);
    const state = useComposeStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.defaults.body).toBe("Half written reply");
    expect(state.defaults.inReplyTo).toBe("<m>");
    expect(state.defaults.kind).toBe("reply");
  });

  it("does not resurrect a message that was closed", async () => {
    useComposeStore.getState().open({ to: "a@example.com" });
    await renderCompose();
    act(() => useComposeStore.getState().close());
    act(() => root.unmount());
    root = createRoot(host);
    expect(useComposeStore.getState().isOpen).toBe(false);
    expect(useComposeStore.getState().defaults).toEqual({});
  });

  it("offers a From choice and preselects the alias a reply came in on", async () => {
    useComposeStore.getState().open({ kind: "reply", to: "a@example.com", fromMailboxId: "alias" });
    await renderCompose();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector(".compose-from-row")?.textContent).toContain(
      "alias@neirmail.com",
    );
    expect(document.body.textContent).toContain("Reply");
  });

  it("schedules an edited draft in place, keeping its server attachments", async () => {
    compose.scheduleSend.mockResolvedValue({ id: "draft-1" });
    useComposeStore.getState().open({
      kind: "draft",
      to: "a@example.com",
      subject: "Plan",
      body: "See attached",
      draftId: "draft-1",
      inReplyTo: "<parent>",
      keptAttachments: [
        { id: "att-keep", fileName: "plan.pdf", sizeBytes: "2048" },
        { id: "att-drop", fileName: "old.pdf", sizeBytes: "10" },
      ],
      attachmentPaths: ["/cache/staged/x/sealed.pdf"],
    });
    await renderCompose();
    expect(document.querySelector(".compose-attachments")?.textContent).toContain("plan.pdf");
    const remove = document.querySelector<HTMLButtonElement>('[aria-label="Remove old.pdf"]')!;
    await act(async () => remove.click());
    const schedule = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Schedule",
    )!;
    await act(async () => schedule.click());
    const confirm = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Schedule message",
    )!;
    await act(async () => confirm.click());

    expect(compose.scheduleSend).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft-1",
        inReplyTo: "<parent>",
        keepAttachmentIds: JSON.stringify(["att-keep"]),
      }),
      ["/cache/staged/x/sealed.pdf"],
    );
    expect(useComposeStore.getState().isOpen).toBe(false);
  });

  it("titles a scheduled draft and starts the picker at its current send time", async () => {
    const when = new Date(Date.now() + 3 * 60 * 60 * 1000);
    when.setSeconds(0, 0);
    useComposeStore.getState().open({
      kind: "draft",
      to: "a@example.com",
      draftId: "draft-2",
      scheduledFor: when.toISOString(),
    });
    await renderCompose();
    expect(document.body.textContent).toContain("Edit scheduled message");
    const schedule = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Schedule",
    )!;
    await act(async () => schedule.click());
    const input = document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    expect(new Date(input.value).getTime()).toBe(when.getTime());
  });

  it("turns a pasted designed email into a formatted message and saves its HTML", async () => {
    compose.saveDraft.mockResolvedValue({ id: "draft-9", created: true });
    useComposeStore.getState().open({ kind: "new", to: "a@example.com" });
    await renderCompose();
    const editor = document.querySelector<HTMLTextAreaElement>(".compose-editor")!;
    const pasted = new Event("paste", { bubbles: true, cancelable: true });
    Object.assign(pasted, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/html"
            ? '<table><tr><td><h1>Sale</h1><a href="https://shop.example">Shop</a><script>x()</script></td></tr></table>'
            : "Sale Shop",
      },
    });
    await act(async () => {
      editor.dispatchEvent(pasted);
    });
    expect(pasted.defaultPrevented).toBe(true);
    expect(document.querySelector(".compose-format-bar")).not.toBeNull();
    expect(document.querySelector("iframe.compose-editor-html")).not.toBeNull();

    const save = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Save draft",
    )!;
    await act(async () => save.click());
    const [fields] = compose.saveDraft.mock.calls[0];
    expect(fields.htmlBody).toContain("<table>");
    expect(fields.htmlBody).toContain('href="https://shop.example"');
    expect(fields.htmlBody).not.toContain("<script");
  });

  it("leaves ordinary pasted text in the plain editor", async () => {
    useComposeStore.getState().open({ kind: "new" });
    await renderCompose();
    const editor = document.querySelector<HTMLTextAreaElement>(".compose-editor")!;
    const pasted = new Event("paste", { bubbles: true, cancelable: true });
    Object.assign(pasted, {
      clipboardData: {
        getData: (type: string) => (type === "text/html" ? "<span>hi</span>" : "hi"),
      },
    });
    await act(async () => {
      editor.dispatchEvent(pasted);
    });
    expect(pasted.defaultPrevented).toBe(false);
    expect(document.querySelector(".compose-format-bar")).toBeNull();
  });
});
