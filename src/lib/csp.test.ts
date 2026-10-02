import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("content security policy", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")) as {
    app: { security: { csp: string } };
  };
  const connectSrc = config.app.security.csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("connect-src"));

  it("only lets the webview talk to the native bridge, never the network", () => {
    expect(connectSrc).toBe("connect-src ipc: http://ipc.localhost");
  });

  it("keeps every request in the frontend off fetch and XMLHttpRequest, since the policy would block it silently", () => {
    const offenders = sourceFiles("src").filter((file) =>
      /\b(fetch\(|XMLHttpRequest)/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
