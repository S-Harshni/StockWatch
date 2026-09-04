import { useEffect, useState } from "react";
import Sparkline from "./Sparkline";
import { CloseIcon, PlusIcon, TrashIcon } from "./icons";
import { deltaTone, formatDeltaBadge, formatWhen, DELTA_BADGE_CLASSES } from "./format";

const API_BASE_URL = "http://localhost:8000";

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-faint mb-0.5">{label}</p>
      <p className="text-[14px] font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

// Fetches its own detail payload on open (GET /stocks/:symbol), which both
// reads the delta since this symbol was last opened *and* checkpoints
// "now" as the new baseline server-side -- so the comparison always reads
// "since you last looked at this stock," not since some other event.
export default function StockDetailModal({ symbol, token, onClose, onUnauthorized, inWatchlist, onAdd, onRemove, pendingWatchlistAction }) {
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setDetail(null);

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/stocks/${encodeURIComponent(symbol)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          onUnauthorized?.();
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Couldn't load ${symbol}`);
        }
        const data = await res.json();
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof TypeError ? "Lost connection to the PulseWatch server." : err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, token, onUnauthorized]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const tone = detail ? deltaTone(detail.delta) : "neutral";

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-lg border border-black/5 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink tracking-tight">{symbol}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:text-ink hover:bg-paper transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {isLoading && (
            <div className="animate-pulse flex flex-col gap-3">
              <div className="h-8 w-32 rounded bg-slate-100" />
              <div className="h-4 w-48 rounded bg-slate-100" />
              <div className="h-24 rounded bg-slate-100" />
            </div>
          )}

          {!isLoading && error && (
            <p className="text-[13px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2.5">{error}</p>
          )}

          {!isLoading && detail && (
            <>
              <div className="flex items-end justify-between gap-4 mb-1">
                <span className="text-[28px] font-bold text-ink tabular-nums leading-none">
                  ${Number(detail.current_price ?? 0).toFixed(2)}
                </span>
                {detail.is_stale && (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mb-1">
                    stale
                  </span>
                )}
              </div>

              <p className="text-[12.5px] text-ink-soft mb-5">
                {detail.last_viewed_at ? (
                  <>
                    Since you last opened this on{" "}
                    <span className="font-medium text-ink">{formatWhen(detail.last_viewed_at)}</span>:{" "}
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-semibold tabular-nums ${DELTA_BADGE_CLASSES[tone]}`}
                    >
                      {formatDeltaBadge(detail.delta, detail.delta_percent)}
                    </span>
                  </>
                ) : (
                  "First time you've opened this stock -- next time you'll see what changed since now."
                )}
              </p>

              <div className="mb-5">
                <Sparkline
                  points={detail.trend_points}
                  delta={detail.delta}
                  lastUpdated={detail.last_updated}
                  width={420}
                  height={70}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <Stat label="Open" value={`$${Number(detail.open ?? 0).toFixed(2)}`} />
                <Stat label="Prev Close" value={`$${Number(detail.prev_close ?? 0).toFixed(2)}`} />
                <Stat label="High" value={`$${Number(detail.high ?? 0).toFixed(2)}`} />
                <Stat label="Low" value={`$${Number(detail.low ?? 0).toFixed(2)}`} />
              </div>

              {inWatchlist ? (
                <button
                  onClick={() => onRemove(symbol)}
                  disabled={pendingWatchlistAction}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-600 text-[13px] font-semibold py-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                >
                  <TrashIcon className="h-4 w-4" />
                  {pendingWatchlistAction ? "Removing…" : "Remove from watchlist"}
                </button>
              ) : (
                <button
                  onClick={() => onAdd(symbol)}
                  disabled={pendingWatchlistAction}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink hover:bg-black disabled:opacity-40 text-white text-[13px] font-semibold py-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  {pendingWatchlistAction ? "Adding…" : "Add to watchlist"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
