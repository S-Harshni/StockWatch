import { useMemo, useState } from "react";

const STORAGE_KEY = "stockwatch_watchlist_order";

function loadOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // fall through to no saved order
  }
  return [];
}

function persistOrder(order) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // private browsing / quota -- the drag still works for this session
  }
}

// Lets the user drag rows into their own order on top of whatever sort is
// currently active (see sort.js / useSortPreference). `order` is just a
// list of symbols, stored client-side; a symbol not yet in it -- newly
// added, or every symbol right after resetOrder() clears it -- falls in at
// the end, in whatever order the incoming (already-sorted) `stocks` prop
// has it. That means with no manual drags since the last sort pick, the
// table simply tracks the active sort live as data updates.
export function useWatchlistOrder(stocks) {
  const [order, setOrder] = useState(loadOrder);

  const orderedStocks = useMemo(() => {
    const bySymbol = new Map(stocks.map((s) => [s.symbol, s]));
    const known = order.filter((symbol) => bySymbol.has(symbol)).map((symbol) => bySymbol.get(symbol));
    const rest = stocks.filter((s) => !order.includes(s.symbol));
    return [...known, ...rest];
  }, [stocks, order]);

  const reorder = (draggedSymbol, targetSymbol) => {
    if (draggedSymbol === targetSymbol) return;
    const current = orderedStocks.map((s) => s.symbol);
    const fromIndex = current.indexOf(draggedSymbol);
    const toIndex = current.indexOf(targetSymbol);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...current];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, draggedSymbol);

    setOrder(next);
    persistOrder(next);
  };

  // Drops any manual drag arrangement so the table falls back to tracking
  // the active sort live -- called when the user explicitly picks a new
  // "Sort by" option, since a stale drag position would otherwise silently
  // fight the sort they just asked for.
  const resetOrder = () => {
    setOrder([]);
    persistOrder([]);
  };

  return [orderedStocks, reorder, resetOrder];
}
