import { useEffect } from "react";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "wheel",
  "touchstart",
  "focus",
] as const;
const CHECK_INTERVAL_MS = 15_000;

export function useIdleLock(minutes: number, onIdle: () => void) {
  useEffect(() => {
    if (minutes <= 0) return;
    let lastActivity = Date.now();
    const markActive = () => {
      lastActivity = Date.now();
    };
    for (const name of ACTIVITY_EVENTS)
      window.addEventListener(name, markActive, { passive: true });
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity >= minutes * 60_000) onIdle();
    }, CHECK_INTERVAL_MS);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, markActive);
      window.clearInterval(timer);
    };
  }, [minutes, onIdle]);
}
