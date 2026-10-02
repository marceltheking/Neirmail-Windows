import { Minus, Square, X } from "@phosphor-icons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useLocation } from "wouter";

const labels: Record<string, string> = {
  mail: "Mail",
  dashboard: "Dashboard",
  settings: "Settings",
};

export function AppTitleBar() {
  const [location] = useLocation();
  const section = location.split("/")[1];
  const label = labels[section] ?? "Sign in";
  const isMac = navigator.userAgent.toLowerCase().includes("mac");
  const windowAction = (action: "minimize" | "toggleMaximize" | "close") => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    return getCurrentWindow()[action]();
  };

  return (
    <header className={`app-titlebar${isMac ? " is-mac" : ""}`} data-tauri-drag-region>
      <div className="app-titlebar-copy" data-tauri-drag-region>
        <span>Neir Mail</span>
        <span className="app-titlebar-separator">/</span>
        <span className="app-titlebar-section">{label}</span>
      </div>
      <div className="app-window-controls">
        <button type="button" aria-label="Minimize" onClick={() => void windowAction("minimize")}>
          <Minus weight="bold" />
        </button>
        <button
          type="button"
          aria-label="Maximize"
          onClick={() => void windowAction("toggleMaximize")}
        >
          <Square />
        </button>
        <button
          type="button"
          className="app-window-close"
          aria-label="Close"
          onClick={() => void windowAction("close")}
        >
          <X />
        </button>
      </div>
    </header>
  );
}
