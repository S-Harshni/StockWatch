import { useEffect, useState } from "react";
import { formatAgo } from "./format";

const STATUS = {
  live: { label: "Live", dot: "bg-brand", classes: "bg-brand-light text-brand-dark border-brand/30" },
  delayed: { label: "Delayed", dot: "bg-amber-500", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  cached: { label: "Cached", dot: "bg-rose-500", classes: "bg-rose-50 text-rose-700 border-rose-200" },
};

// Ticks its own clock so a "Xs ago" label stays live without re-rendering
// the rest of the dashboard every second.
export default function SyncStatusPill({ status, lastSyncedAt }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const config = STATUS[status] || STATUS.live;
  const secondsAgo = lastSyncedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 1000))
    : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium whitespace-nowrap ${config.classes}`}
      title={lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` : "No sync yet"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
      {secondsAgo != null && <span className="opacity-70">· Synced {formatAgo(secondsAgo)}</span>}
    </span>
  );
}
