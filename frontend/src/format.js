export function deltaTone(delta) {
  if (delta == null || delta === 0) return "neutral";
  return delta > 0 ? "positive" : "negative";
}

export function formatDeltaBadge(delta, deltaPercent) {
  if (delta == null) return "—";
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const amount = Math.abs(delta).toFixed(2);
  const pct = deltaPercent != null ? Math.abs(deltaPercent).toFixed(2) : null;
  return `${sign}$${amount}${pct != null ? ` (${sign}${pct}%)` : ""}`;
}

export function formatAgo(seconds) {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatWhen(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const DELTA_BADGE_CLASSES = {
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  negative: "bg-rose-50 text-rose-700 border-rose-200",
  neutral: "bg-slate-50 text-slate-500 border-slate-200",
};
