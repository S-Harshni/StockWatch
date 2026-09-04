import ColumnPicker from "./ColumnPicker";
import Sparkline from "./Sparkline";
import { useColumnPrefs } from "./useColumnPrefs";
import { PlusIcon, TrashIcon } from "./icons";
import { deltaTone, formatDeltaBadge, DELTA_BADGE_CLASSES } from "./format";

// `locked` columns can't be hidden via the picker, but their position can
// still be dragged. Symbol (row identity) and the Add/Remove action stay
// pinned outside this list -- always first and always last respectively.
const COLUMN_DEFS = [
  { key: "price", label: "Price", locked: true },
  { key: "change", label: "Change (Day)" },
  { key: "range", label: "Day Range" },
  { key: "trend", label: "Trend" },
];
const ALL_KEYS = COLUMN_DEFS.map((c) => c.key);

function DeltaBadge({ delta, deltaPercent }) {
  const tone = deltaTone(delta);
  if (delta == null) {
    return <span className="text-[12.5px] text-ink-faint">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-semibold tabular-nums ${DELTA_BADGE_CLASSES[tone]}`}
    >
      {formatDeltaBadge(delta, deltaPercent)}
    </span>
  );
}

export default function AllStocksTable({ stocks, onAdd, pendingAdd, onRemove, pendingRemoval, onSelect }) {
  const { visible, setVisible, orderedKeys, reorderColumn } = useColumnPrefs(ALL_KEYS);

  if (!stocks || stocks.length === 0) {
    return (
      <div className="rounded-xl border border-black/5 bg-white p-10 text-center">
        <p className="text-[13.5px] text-ink-faint">No stocks to show yet.</p>
      </div>
    );
  }

  const columnRenderers = {
    price: (stock) => (
      <span className="text-[13.5px] font-semibold text-ink tabular-nums">${Number(stock.current_price ?? 0).toFixed(2)}</span>
    ),
    change: (stock) => <DeltaBadge delta={stock.delta} deltaPercent={stock.delta_percent} />,
    range: (stock) => (
      <span className="text-[11.5px] text-ink-faint tabular-nums">
        {Number(stock.low ?? 0).toFixed(2)} – {Number(stock.high ?? 0).toFixed(2)}
      </span>
    ),
    trend: (stock) => <Sparkline points={stock.trend_points} delta={stock.delta} lastUpdated={stock.last_updated} />,
  };

  const RIGHT_ALIGNED = new Set(["price", "change", "range"]);

  const activeColumns = orderedKeys
    .map((key) => COLUMN_DEFS.find((c) => c.key === key))
    .filter((col) => col && (col.locked || visible.has(col.key)));

  return (
    <div>
      <div className="flex justify-end mb-2">
        <ColumnPicker
          columns={orderedKeys.map((key) => COLUMN_DEFS.find((c) => c.key === key)).filter(Boolean)}
          visible={visible}
          onVisibilityChange={setVisible}
          onReorder={reorderColumn}
        />
      </div>

      <div className="rounded-xl border border-black/5 bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black/5 text-[11.5px] uppercase tracking-wide text-ink-faint whitespace-nowrap">
                <th className="px-5 py-3 font-medium">Symbol</th>
                {activeColumns.map((col) => (
                  <th key={col.key} className={`px-5 py-3 font-medium ${RIGHT_ALIGNED.has(col.key) ? "text-right" : ""}`}>
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-3 w-28" />
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => {
                const isAdding = pendingAdd === stock.symbol;
                const isRemoving = pendingRemoval === stock.symbol;

                return (
                  <tr
                    key={stock.symbol}
                    onClick={() => onSelect?.(stock.symbol)}
                    className="border-b border-black/5 last:border-0 hover:bg-paper/70 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-ink text-[13.5px]">{stock.symbol}</span>
                      {stock.is_stale && (
                        <span className="ml-2 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          stale
                        </span>
                      )}
                    </td>

                    {activeColumns.map((col) => (
                      <td key={col.key} className={`px-5 py-3.5 ${RIGHT_ALIGNED.has(col.key) ? "text-right" : ""}`}>
                        {columnRenderers[col.key](stock)}
                      </td>
                    ))}

                    <td className="px-3 py-3.5">
                      {stock.in_watchlist ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(stock.symbol);
                          }}
                          disabled={isRemoving}
                          title={`Remove ${stock.symbol} from watchlist`}
                          className="inline-flex items-center gap-1 rounded-lg border border-black/10 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed text-ink-soft hover:text-rose-600 text-[12.5px] font-semibold px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                        >
                          <TrashIcon className="h-3 w-3" />
                          {isRemoving ? "Removing…" : "Remove"}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAdd(stock.symbol);
                          }}
                          disabled={isAdding}
                          className="inline-flex items-center gap-1 rounded-lg bg-ink hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12.5px] font-semibold px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                        >
                          <PlusIcon className="h-3 w-3" />
                          {isAdding ? "Adding…" : "Add"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
