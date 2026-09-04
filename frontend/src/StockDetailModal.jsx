import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Sparkline from "./Sparkline";
import { CloseIcon, PlusIcon, TrashIcon, ExternalLinkIcon } from "./icons";
import { deltaTone, formatDeltaBadge, formatWhen, DELTA_BADGE_CLASSES } from "./format";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const TAG_STYLES = {
  Breakout: "bg-violet-50 text-violet-700 border-violet-200",
  "Volume Surge": "bg-brand-light text-brand-dark border-brand/30",
  "Above-Avg Volume": "bg-sky-50 text-sky-700 border-sky-200",
  "Big Mover": "bg-rose-50 text-rose-700 border-rose-200",
  Momentum: "bg-amber-50 text-amber-700 border-amber-200",
  Steady: "bg-slate-50 text-slate-500 border-slate-200",
};

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-faint mb-0.5">{label}</p>
      <p className="text-[14px] font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

function SectionHeading({ children }) {
  return <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint mb-3">{children}</h3>;
}

// Finnhub reports market cap and shares outstanding in millions.
function formatMarketCap(millions) {
  if (millions == null) return null;
  const value = millions * 1e6;
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toFixed(0)}`;
}

function formatShares(millions) {
  if (millions == null) return null;
  if (millions >= 1000) return `${(millions / 1000).toFixed(2)}B`;
  return `${millions.toFixed(1)}M`;
}

function formatNewsDate(unixSeconds) {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Fetches its own detail payload on open (GET /stocks/:symbol), which both
// reads the delta since this symbol was last opened *and* checkpoints
// "now" as the new baseline server-side -- so the comparison always reads
// "since you last looked at this stock," not since some other event.
// Company insights (GET /stocks/:symbol/insights) load in parallel and are
// treated as best-effort: a failure there just hides that section instead
// of blocking the price view, which is the part that actually matters.
export default function StockDetailModal({
  symbol,
  token,
  onClose,
  onUnauthorized,
  onSelectSymbol,
  inWatchlist,
  onAdd,
  onRemove,
  pendingWatchlistAction,
}) {
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setDetail(null);
    setInsights(null);

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
        if (!cancelled) setError(err instanceof TypeError ? "Lost connection to the StockWatch server." : err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/stocks/${encodeURIComponent(symbol)}/insights`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setInsights(data);
      } catch {
        // best-effort -- leave insights null, that section just won't render
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
  const marketCap = insights ? formatMarketCap(insights.market_cap) : null;
  const shares = insights ? formatShares(insights.shares_outstanding) : null;

  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="w-full max-w-lg rounded-2xl bg-card shadow-lg border border-line max-h-[85vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div className="sticky top-0 bg-card border-b border-line px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {insights?.logo && (
              <img
                src={insights.logo}
                alt=""
                className="h-9 w-9 rounded-lg object-contain bg-card-alt border border-line shrink-0"
              />
            )}
            <div className="min-w-0">
              <h2 className="text-[16px] font-bold text-ink tracking-tight truncate">{insights?.name || symbol}</h2>
              {insights?.name && <p className="text-[11px] text-ink-faint tracking-wide">{symbol}</p>}
            </div>
          </div>
          <motion.button
            onClick={onClose}
            aria-label="Close"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.12 }}
            className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:text-ink hover:bg-paper transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 shrink-0"
          >
            <CloseIcon className="h-4 w-4" />
          </motion.button>
        </div>

        <div className="px-6 py-5">
          {isLoading && (
            <div className="animate-pulse flex flex-col gap-3">
              <div className="h-8 w-32 rounded bg-card-alt" />
              <div className="h-4 w-48 rounded bg-card-alt" />
              <div className="h-24 rounded bg-card-alt" />
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

              <div className="grid grid-cols-3 gap-4 mb-5">
                <Stat label="Open" value={`$${Number(detail.open ?? 0).toFixed(2)}`} />
                <Stat label="High" value={`$${Number(detail.high ?? 0).toFixed(2)}`} />
                <Stat label="Low" value={`$${Number(detail.low ?? 0).toFixed(2)}`} />
                <Stat label="Prev Close" value={`$${Number(detail.prev_close ?? 0).toFixed(2)}`} />
                <Stat label="Volume" value={detail.volume ?? "—"} />
                <Stat label="Attention" value={Math.round(detail.attention_score || 0)} />
              </div>

              {detail.context_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {detail.context_tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[11px] font-medium rounded-full px-2 py-0.5 border ${TAG_STYLES[tag] || TAG_STYLES.Steady}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {insights && (insights.industry || insights.exchange || marketCap) && (
                <div className="mb-6 pt-5 border-t border-line">
                  <SectionHeading>About {insights.name || symbol}</SectionHeading>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Stat label="Industry" value={insights.industry || "—"} />
                    <Stat label="Exchange" value={insights.exchange || "—"} />
                    <Stat label="Country" value={insights.country || "—"} />
                    <Stat label="IPO Date" value={insights.ipo || "—"} />
                    <Stat label="Market Cap" value={marketCap || "—"} />
                    <Stat label="Shares Out." value={shares || "—"} />
                  </div>
                  {insights.website && (
                    <a
                      href={insights.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-dark hover:underline"
                    >
                      Visit website
                      <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              {insights?.peers?.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>Related Companies</SectionHeading>
                  <div className="flex flex-wrap gap-1.5">
                    {insights.peers.map((peer) => (
                      <motion.button
                        key={peer}
                        onClick={() => onSelectSymbol?.(peer)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.12 }}
                        className="rounded-full border border-line hover:border-brand/30 hover:bg-brand-light text-[12px] font-medium text-ink-soft hover:text-brand-dark px-2.5 py-1 transition-colors cursor-pointer"
                      >
                        {peer}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {insights?.news?.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>Recent News</SectionHeading>
                  <div className="flex flex-col gap-2.5">
                    {insights.news.map((item) => (
                      <a
                        key={item.url}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg border border-line hover:border-brand/20 hover:bg-card-alt p-3 transition-colors"
                      >
                        <p className="text-[13px] font-semibold text-ink leading-snug mb-1">{item.headline}</p>
                        <p className="text-[11.5px] text-ink-faint">
                          {item.source}
                          {formatNewsDate(item.datetime) ? ` · ${formatNewsDate(item.datetime)}` : ""}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {inWatchlist ? (
                <motion.button
                  onClick={() => onRemove(symbol)}
                  disabled={pendingWatchlistAction}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-600 text-[13px] font-semibold py-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                >
                  <TrashIcon className="h-4 w-4" />
                  {pendingWatchlistAction ? "Removing…" : "Remove from watchlist"}
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => onAdd(symbol)}
                  disabled={pendingWatchlistAction}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-[13px] font-semibold py-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  {pendingWatchlistAction ? "Adding…" : "Add to watchlist"}
                </motion.button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
