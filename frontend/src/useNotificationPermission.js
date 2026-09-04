import { useState } from "react";

const isSupported = typeof window !== "undefined" && "Notification" in window;

// "default" (never asked), "granted", "denied", or "unsupported" for
// browsers without the Notification API at all.
export function useNotificationPermission() {
  const [permission, setPermission] = useState(isSupported ? Notification.permission : "unsupported");

  const requestPermission = async () => {
    if (!isSupported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return { permission, requestPermission, isSupported };
}
