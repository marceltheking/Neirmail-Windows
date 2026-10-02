import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { queryClient } from "./lib/queryClient";
import { useAuthStore } from "./lib/state/authStore";
import { registerQuitHandler } from "./lib/native/quit";
import { initializeAppSettings } from "./lib/state/appSettingsStore";
import "./styles/global.css";

initializeAppSettings();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

void registerQuitHandler().catch(() => undefined);
void useAuthStore.getState().boot();
