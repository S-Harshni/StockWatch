import { useMemo, useState } from "react";

const STORAGE_KEY = "pulsewatch_watchlist_order";

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

// Lets the user drag rows into their own order, independent of the
// Attention Score sort the API returns. `order` is just a list of symbols,
// stored client-side; a symbol not yet in it (newly added) falls in at the
// end, in whatever order the incoming `stocks` prop already has it.
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

  return [orderedStocks, reorder];
}
