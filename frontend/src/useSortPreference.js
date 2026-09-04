import { useState } from "react";
import { DEFAULT_SORT_MODE } from "./sort";

const STORAGE_KEY = "stockwatch_sort_mode";

// Shared across the Watchlist and All Stocks tables (mirrors
// useColumnPrefs) so picking a sort once applies everywhere. Just persists
// *which* option is active -- each table is responsible for actually
// applying it (see sort.js's sortStocks) and, for the Watchlist table,
// for dropping any manual row-drag order that would otherwise fight it
// (see useWatchlistOrder's resetOrder).
export function useSortPreference() {
  const [sortMode, setSortModeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_SORT_MODE;
    } catch {
      return DEFAULT_SORT_MODE;
    }
  });

  const setSortMode = (key) => {
    setSortModeState(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // private browsing / quota -- selection just won't persist
    }
  };

  return [sortMode, setSortMode];
}
