import { useMemo, useState } from "react";

const VISIBLE_KEY = "stockwatch_columns";
const ORDER_KEY = "stockwatch_column_order";
export const DEFAULT_VISIBLE_COLUMNS = ["change", "volume", "trend", "attention", "signals"];

function loadVisible() {
  try {
    const saved = JSON.parse(localStorage.getItem(VISIBLE_KEY));
    if (Array.isArray(saved)) return new Set(saved);
  } catch {
    // fall through to default
  }
  return new Set(DEFAULT_VISIBLE_COLUMNS);
}

function loadOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // fall through to no saved order
  }
  return [];
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private browsing / quota -- selection just won't persist
  }
}

// Shared across the Watchlist and All Stocks tables so picking/reordering
// columns once applies everywhere -- all read/write the same localStorage
// keys. `allKeys` is the full set of column keys *this* table knows about
// (the two tables' sets differ slightly), used to fold in any key missing
// from a saved order (new columns, or one table's key the other doesn't
// have) at the end rather than dropping it.
export function useColumnPrefs(allKeys) {
  const [visible, setVisibleState] = useState(loadVisible);
  const [order, setOrderState] = useState(loadOrder);

  const setVisible = (next) => {
    setVisibleState(next);
    persist(VISIBLE_KEY, [...next]);
  };

  const setOrder = (next) => {
    setOrderState(next);
    persist(ORDER_KEY, next);
  };

  const orderedKeys = useMemo(() => {
    const known = order.filter((key) => allKeys.includes(key));
    const missing = allKeys.filter((key) => !known.includes(key));
    return [...known, ...missing];
  }, [order, allKeys]);

  const reorderColumn = (draggedKey, targetKey) => {
    if (draggedKey === targetKey) return;
    const current = [...orderedKeys];
    const fromIndex = current.indexOf(draggedKey);
    const toIndex = current.indexOf(targetKey);
    if (fromIndex === -1 || toIndex === -1) return;

    current.splice(fromIndex, 1);
    current.splice(toIndex, 0, draggedKey);
    setOrder(current);
  };

  return { visible, setVisible, orderedKeys, reorderColumn };
}
