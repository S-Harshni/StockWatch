import { useState, useEffect, useCallback, useRef } from "react";
import { POLL_INTERVAL_MS } from "./useWatchlistStore";

const API_BASE_URL = "http://localhost:8000";

/**
 * Data source for the "All Stocks" browse page -- the curated universe list
 * (GET /stocks), independent of the watchlist store. Same stale-response
 * guard as useWatchlistStore: each request is stamped with a monotonically
 * increasing id and a response is only applied if nothing newer has since
 * been issued.
 */
export function useStockUniverse(token, onUnauthorized) {
  const [stocks, setStocks] = useState([]);
  const [dataStatus, setDataStatus] = useState("live");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const latestRequestId = useRef(0);

  const fetchStocks = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    try {
      const res = await fetch(`${API_BASE_URL}/stocks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!res.ok) throw new Error(`Failed to load stocks (${res.status})`);
      const data = await res.json();
      if (requestId !== latestRequestId.current) return;
      setStocks(data.stocks || []);
      setDataStatus(data.data_status);
      setError(null);
    } catch (err) {
      if (requestId !== latestRequestId.current) return;
      setError(err instanceof TypeError ? "Lost connection to the PulseWatch server." : err.message);
    } finally {
      if (requestId === latestRequestId.current) setIsLoading(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStocks]);

  return { stocks, dataStatus, isLoading, error, refetch: fetchStocks };
}
