import { useState } from "react";

const STORAGE_KEY = "stockwatch_alerts_enabled";

// Separate from Notification permission (which the browser never lets JS
// revoke) -- this is the in-app on/off switch, persisted so a pause
// survives a refresh.
export function useAlertsEnabled() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore write failures
      }
      return next;
    });
  };

  return [enabled, toggle];
}
