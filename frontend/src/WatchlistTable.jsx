import { motion } from "framer-motion";
import ColumnPicker from "./ColumnPicker";
import SortPicker from "./SortPicker";
import Sparkline from "./Sparkline";
import CheckedBadge from "./CheckedBadge";
import { useColumnPrefs } from "./useColumnPrefs";
import { useWatchlistOrder } from "./useWatchlistOrder";
import { useDragReorder } from "./useDragReorder";
import { useSortPreference } from "./useSortPreference";
import { sortStocks } from "./sort";
import { TrashIcon, GripIcon } from "./icons";
import { deltaTone, formatDeltaBadge, DELTA_BADGE_CLASSES } from "./format";

const TAG_STYLES = {
  Breakout: "bg-violet-50 text-violet-700 border-violet-200",
  "Volume Surge": "bg-brand-light text-brand-dark border-brand/30",
  "Above-Avg Volume": "bg-sky-50 text-sky-700 border-sky-200",
  "Big Mover": "bg-rose-50 text-rose-700 border-rose-200",
  Momentum: "bg-amber-50 text-amber-700 border-amber-200",
  Steady: "bg-slate-50 text-slate-500 border-slate-200",
};

// `locked` columns can't be hidden via the picker, but their position
// (relative to each other and the other columns) can still be dragged.
// Symbol (row identity) and the Remove action stay pinned outside this
// list -- always first and always last respectively.
const COLUMN_DEFS = [
  { key: "price", label: "Price", locked: true },
  { key: "change", label: "Since Last Visit" },
  { key: "volume", label: "Volume" },
  { key: "range", label: "Day Range" },
  { key: "trend", label: "Trend" },
  { key: "attention", label: "Attention" },
  { key: "signals", label: "Signals" },
  { key: "lastVisited", label: "Last Visited", locked: true },
];
const ALL_KEYS = COLUMN_DEFS.map((c) => c.key);

function ScoreBar({ score }) {
  const color = score > 70 ? "bg-brand" : score > 40 ? "bg-amber-400" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-card-alt overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="text-[13px] font-semibold text-ink tabular-nums">{Math.round(score)}</span>
    </div>
  );
}

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

export default function WatchlistTable({ stocks, onRemove, pendingRemoval, onSelect }) {
  const { visible, setVisible, orderedKeys, reorderColumn } = useColumnPrefs(ALL_KEYS);
  const [sortMode, setSortMode] = useSortPreference();
  const sortedStocks = sortStocks(stocks, sortMode);
  const [orderedStocks, reorderRow, resetRowOrder] = useWatchlistOrder(sortedStocks);
  const { draggedKey: draggedRow, dragOverKey: dragOverRow, startDrag: startRowDrag } = useDragReorder(reorderRow, "data-row-key");

  // Picking a new sort should visibly re-arrange the table even if the user
  // dragged rows into a custom order earlier -- see useWatchlistOrder.
  const handleSortChange = (nextMode) => {
    setSortMode(nextMode);
    resetRowOrder();
  };

  if (!stocks || stocks.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-card p-10 text-center">
        <p className="text-[13.5px] text-ink-faint">Your watchlist is empty — add a symbol above to get started.</p>
      </div>
    );
  }

  const columnRenderers = {
    price: (stock) => (
      <span className="text-[13.5px] font-semibold text-ink tabular-nums">${Number(stock.current_price ?? 0).toFixed(2)}</span>
    ),
    change: (stock) => <DeltaBadge delta={stock.delta} deltaPercent={stock.delta_percent} />,
    volume: (stock) => <span className="text-[13px] text-ink-soft tabular-nums">{stock.volume ?? "—"}</span>,
    range: (stock) => (
      <span className="text-[11.5px] text-ink-faint tabular-nums">
        {Number(stock.low ?? 0).toFixed(2)} – {Number(stock.high ?? 0).toFixed(2)}
      </span>
    ),
    trend: (stock) => <Sparkline points={stock.trend_points} delta={stock.delta} lastUpdated={stock.last_updated} />,
    attention: (stock) => <ScoreBar score={stock.attention_score || 0} />,
    signals: (stock) => (
      <div className="flex flex-wrap gap-1.5">
        {(stock.context_tags || []).map((tag) => (
          <span key={tag} className={`text-[11px] font-medium rounded-full px-2 py-0.5 border ${TAG_STYLES[tag] || TAG_STYLES.Steady}`}>
            {tag}
          </span>
        ))}
      </div>
    ),
    lastVisited: (stock) => <CheckedBadge stock={stock} onOpen={onSelect} />,
  };

  const RIGHT_ALIGNED = new Set(["price", "change", "volume", "range"]);

  const activeColumns = orderedKeys
    .map((key) => COLUMN_DEFS.find((c) => c.key === key))
    .filter((col) => col && (col.locked || visible.has(col.key)));

  return (
    <div>
      <div className="flex justify-end items-center gap-2 mb-2">
        <SortPicker value={sortMode} onChange={handleSortChange} />
        <ColumnPicker
          columns={orderedKeys.map((key) => COLUMN_DEFS.find((c) => c.key === key)).filter(Boolean)}
          visible={visible}
          onVisibilityChange={setVisible}
          onReorder={reorderColumn}
        />
      </div>

      <div className="rounded-xl border border-line bg-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-ink-faint whitespace-nowrap">
                <th className="w-8" />
                <th className="px-5 py-3 font-medium">Symbol</th>
                {activeColumns.map((col) => (
                  <th key={col.key} className={`px-5 py-3 font-medium ${RIGHT_ALIGNED.has(col.key) ? "text-right" : ""}`}>
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {orderedStocks.map((stock) => {
                const isRemoving = pendingRemoval === stock.symbol;
                const isDragging = draggedRow === stock.symbol;
                const isDragTarget = dragOverRow === stock.symbol && draggedRow !== stock.symbol;

                return (
                  <tr
                    key={stock.symbol}
                    data-row-key={stock.symbol}
                    onClick={() => onSelect?.(stock.symbol)}
                    className={`border-b last:border-0 hover:bg-card-alt transition-colors group cursor-pointer ${
                      isDragTarget ? "border-t-2 border-t-brand" : "border-line"
                    } ${isDragging ? "opacity-40" : ""}`}
                  >
                    <td
                      onPointerDown={startRowDrag(stock.symbol)}
                      className="pl-4 pr-1 py-3.5 text-ink-faint/60 group-hover:text-ink-faint cursor-grab active:cursor-grabbing"
                      style={{ touchAction: "none" }}
                      title="Drag to reorder"
                    >
                      <GripIcon className="h-4 w-4" />
                    </td>

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
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(stock.symbol);
                        }}
                        disabled={isRemoving}
                        title={`Remove ${stock.symbol}`}
                        aria-label={`Remove ${stock.symbol} from watchlist`}
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ duration: 0.12 }}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint/80 hover:text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </motion.button>
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
