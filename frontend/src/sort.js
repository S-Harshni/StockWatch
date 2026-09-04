// Sort modes for the "Sort by" menu, shared by the Watchlist and All Stocks
// tables (SortPicker.jsx). Each mode is a self-contained { key, label,
// compare } entry so adding a new one never has to touch a table component.

function byNumber(getValue, direction) {
  return (a, b) => {
    const valueA = getValue(a);
    const valueB = getValue(b);
    // A stock with no computable value yet (e.g. delta before any baseline
    // snapshot exists, or volume before the first successful poll) sinks
    // to the bottom regardless of direction, rather than jumping to the
    // top of an ascending sort.
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return 1;
    if (valueB == null) return -1;
    return direction === "asc" ? valueA - valueB : valueB - valueA;
  };
}

export const DEFAULT_SORT_MODE = "attention";

export const SORT_OPTIONS = [
  { key: "attention", label: "Attention Score", compare: byNumber((s) => s.attention_score, "desc") },
  { key: "name_asc", label: "Name (A → Z)", compare: (a, b) => a.symbol.localeCompare(b.symbol) },
  { key: "name_desc", label: "Name (Z → A)", compare: (a, b) => b.symbol.localeCompare(a.symbol) },
  { key: "profit_desc", label: "Most Profit (Top Gainers)", compare: byNumber((s) => s.delta_percent, "desc") },
  { key: "profit_asc", label: "Biggest Loss (Top Losers)", compare: byNumber((s) => s.delta_percent, "asc") },
  { key: "price_desc", label: "Price (High → Low)", compare: byNumber((s) => s.current_price, "desc") },
  { key: "price_asc", label: "Price (Low → High)", compare: byNumber((s) => s.current_price, "asc") },
  { key: "volume_desc", label: "Volume (High → Low)", compare: byNumber((s) => s.current_volume, "desc") },
];

export function sortStocks(stocks, sortKey) {
  const mode = SORT_OPTIONS.find((option) => option.key === sortKey) || SORT_OPTIONS[0];
  return [...stocks].sort(mode.compare);
}
