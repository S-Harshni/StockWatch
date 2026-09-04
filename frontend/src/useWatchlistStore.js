import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
// The backend's own market-data cache only refreshes every 30s (Finnhub
// free-tier rate limits -- see POLL_INTERVAL_SECONDS in engine.py), but
// polling *our own* API this often costs nothing external -- it's just
// re-reading an in-memory cache -- so the UI picks up whatever's newest
// within a second instead of waiting up to 30s for the next frontend poll.
export const POLL_INTERVAL_MS = 1000;

/**
 * Single source of truth for watchlist data, shared by the Watchlist page
 * and the "Add to watchlist" action on the All Stocks page.
 *
 * The subtler bug this also closes: fetchWatchlist() runs on mount and every
 * POLL_INTERVAL_MS, and in dev, React StrictMode double-invokes effects --
 * so two overlapping /watchlist requests can be in flight at once, and
 * nothing guaranteed they'd *resolve* in the order they were sent. A stale
 * response landing after a fresher one would silently overwrite it. Every
 * network call here is stamped with a monotonically increasing request id;
 * a response is only applied if no newer request has been issued since.
 */
export function useWatchlistStore(token, onUnauthorized) {
  const [stocks, setStocks] = useState([]);
  const [dataStatus, setDataStatus] = useState("live");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [lastVisitedAt, setLastVisitedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const latestRequestId = useRef(0);

  const authedFetch = useCallback(
    (path, options = {}) =>
      fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      }),
    [token]
  );

  const applyPayload = useCallback((data) => {
    setStocks(data.stocks || []);
    setDataStatus(data.data_status);
    setLastSyncedAt(data.last_synced_at);
    setLastVisitedAt(data.last_visited_at);
  }, []);

  const fetchWatchlist = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    try {
      const res = await authedFetch("/watchlist");
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!res.ok) throw new Error(`Failed to load watchlist (${res.status})`);
      const data = await res.json();
      if (requestId !== latestRequestId.current) return; // superseded by a newer request
      applyPayload(data);
      setError(null);
    } catch (err) {
      if (requestId !== latestRequestId.current) return;
      setError(err instanceof TypeError ? "Lost connection to the StockWatch server." : err.message);
    } finally {
      if (requestId === latestRequestId.current) setIsLoading(false);
    }
  }, [authedFetch, onUnauthorized, applyPayload]);

  useEffect(() => {
    fetchWatchlist();
    const interval = setInterval(fetchWatchlist, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchWatchlist]);

  const addSymbol = useCallback(
    async (symbol) => {
      const requestId = ++latestRequestId.current;
      const res = await authedFetch("/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
        throw new Error(detail || `Couldn't add ${symbol}`);
      }
      const data = await res.json();
      if (requestId === latestRequestId.current) applyPayload(data);
    },
    [authedFetch, applyPayload]
  );

  const removeSymbol = useCallback(
    async (symbol) => {
      // Optimistic: the row disappears the instant you click.
      setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
      try {
        const requestId = ++latestRequestId.current;
        const res = await authedFetch(`/watchlist/${symbol}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Couldn't remove ${symbol}`);
        const data = await res.json();
        if (requestId === latestRequestId.current) applyPayload(data);
      } catch (err) {
        setError(err.message);
        fetchWatchlist(); // resync from server truth rather than trust the optimistic guess
        throw err;
      }
    },
    [authedFetch, applyPayload, fetchWatchlist]
  );

  // Attention Score drives what deserves a look, so it's always the sort
  // key -- computed once here, shared by every consumer.
  const sortedStocks = useMemo(
    () => [...stocks].sort((a, b) => (b.attention_score || 0) - (a.attention_score || 0)),
    [stocks]
  );

  return {
    stocks: sortedStocks,
    dataStatus,
    lastSyncedAt,
    lastVisitedAt,
    isLoading,
    error,
    setError,
    addSymbol,
    removeSymbol,
    refetch: fetchWatchlist,
  };
}
