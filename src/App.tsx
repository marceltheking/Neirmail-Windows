import { lazy, Suspense, useCallback, useState } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { LoginPage } from "./pages/LoginPage";
import { TwoFactorPage } from "./pages/TwoFactorPage";
import { UnlockPage } from "./pages/UnlockPage";
import { AppTitleBar } from "./components/layout/AppTitleBar";
import { SplashScreen } from "./components/layout/SplashScreen";
import { AppToaster } from "./components/shared/Toast";
import { NeirLogo } from "./components/shared/NeirLogo";
import { useAuthStore } from "./lib/state/authStore";
import { hasSeenIntro } from "./lib/state/intro";

const DesktopApplication = lazy(() =>
  import("./components/layout/DesktopApplication").then((module) => ({
    default: module.DesktopApplication,
  })),
);
const UiPreviewApplication = import.meta.env.DEV
  ? lazy(() =>
      import("./dev/UiPreviewApplication").then((module) => ({
        default: module.UiPreviewApplication,
      })),
    )
  : null;

function DesktopFallback() {
  return (
    <div className="app-frame">
      <AppTitleBar />
      <div className="app-bootstrap-state" role="status">
        <NeirLogo />
        <span>Opening your private workspace…</span>
      </div>
    </div>
  );
}

function WindowPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-frame">
      <AppTitleBar />
      <div className="standalone-window">
        <div className="standalone-page-transition">{children}</div>
      </div>
    </div>
  );
}

function AppContent() {
  const phase = useAuthStore((state) => state.phase);
  const [introDone, setIntroDone] = useState(hasSeenIntro);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  if (
    UiPreviewApplication &&
    new URLSearchParams(window.location.search).get("ui-preview") === "true"
  ) {
    return (
      <Suspense fallback={<DesktopFallback />}>
        <UiPreviewApplication />
      </Suspense>
    );
  }

  if (!introDone) return <SplashScreen onDone={finishIntro} />;
  if (phase === "booting") return <DesktopFallback />;
  if (phase === "signed_out")
    return (
      <WindowPage>
        <LoginPage />
      </WindowPage>
    );
  if (phase === "awaiting_2fa")
    return (
      <WindowPage>
        <TwoFactorPage />
      </WindowPage>
    );
  if (phase === "locked")
    return (
      <WindowPage>
        <UnlockPage />
      </WindowPage>
    );
  return (
    <Suspense fallback={<DesktopFallback />}>
      <DesktopApplication />
    </Suspense>
  );
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <TooltipPrimitive.Provider delayDuration={450} skipDelayDuration={100}>
        <AppContent />
        <AppToaster />
      </TooltipPrimitive.Provider>
    </Router>
  );
}
