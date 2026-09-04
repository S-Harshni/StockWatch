import { useEffect, useState } from "react";
import { deltaTone, formatDeltaBadge, formatAgo, DELTA_BADGE_CLASSES } from "./format";

const ARROW = { positive: "↑", negative: "↓", neutral: "→" };

function clockTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

// Its own "Updated" column on both tables. Baselined the moment a symbol
// is added to the watchlist (see POST /watchlist), and re-baselined every
// time its detail view is opened (see GET /stocks/:symbol) -- so it always
// reads "since you added/last checked this stock," never blank for
// anything actually on the watchlist. Ticks its own clock so "Xm ago"
// stays live without a data refetch. Clicking it opens the detail view.
export default function CheckedBadge({ stock, onOpen }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!stock.checked_at) {
    return <span className="text-[12.5px] text-ink-faint">—</span>;
  }

  const tone = deltaTone(stock.checked_delta);
  const checkedAtMs = new Date(stock.checked_at).getTime();
  const now = Date.now();
  const secondsAgo = Math.max(0, Math.floor((now - checkedAtMs) / 1000));

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen(stock.symbol);
      }}
      title={`Last opened ${clockTime(stock.checked_at)} — now ${clockTime(now)} (${formatAgo(secondsAgo)})`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums transition hover:brightness-95 cursor-pointer whitespace-nowrap ${DELTA_BADGE_CLASSES[tone]}`}
    >
      {formatAgo(secondsAgo)} · {ARROW[tone]} {formatDeltaBadge(stock.checked_delta, stock.checked_delta_percent)}
    </button>
  );
}
