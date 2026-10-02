import type { ReactNode } from "react";
import { AppTitleBar } from "./AppTitleBar";
import { AppDock } from "./AppDock";

export function AppShell({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`app-frame${compact ? " is-compact" : ""}`}>
      <AppTitleBar />
      <div className="app-frame-body">
        <AppDock />
        <main className="app-workspace">{children}</main>
      </div>
    </div>
  );
}
