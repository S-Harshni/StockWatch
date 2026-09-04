import { useState } from "react";
import WatchlistTable from "./WatchlistTable";
import AllStocksTable from "./AllStocksTable";
import StockDetailModal from "./StockDetailModal";
import SyncStatusPill from "./SyncStatusPill";
import { useWatchlistStore } from "./useWatchlistStore";
import { useStockUniverse } from "./useStockUniverse";
import { PlusIcon, LogoutIcon } from "./icons";

function TableSkeleton() {
  return (
    <div
      className="rounded-xl border border-black/5 bg-white shadow-card overflow-hidden"
      aria-busy="true"
      aria-label="Loading stocks"
    >
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex items-center gap-4 px-5 py-4 border-b border-black/5 last:border-0 animate-pulse">
          <div className="h-3.5 w-14 rounded bg-slate-100" />
          <div className="h-3.5 w-16 rounded bg-slate-100 ml-auto" />
          <div className="h-3.5 w-20 rounded bg-slate-100" />
          <div className="h-6 w-24 rounded bg-slate-100" />
          <div className="h-3.5 w-10 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ token, userId, onLogout }) {
  const store = useWatchlistStore(token, onLogout);
  const universe = useStockUniverse(token, onLogout);

  const [newSymbol, setNewSymbol] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [pendingAdd, setPendingAdd] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  const handleAddSymbol = async (e) => {
    e.preventDefault();
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol) return;

    setIsAdding(true);
    setAddError(null);
    try {
      await store.addSymbol(symbol);
      setNewSymbol("");
      universe.refetch();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddFromUniverse = async (symbol) => {
    setPendingAdd(symbol);
    try {
      await store.addSymbol(symbol);
      universe.refetch();
    } catch (err) {
      store.setError(err.message);
    } finally {
      setPendingAdd(null);
    }
  };

  const handleRemoveSymbol = async (symbol) => {
    setPendingRemoval(symbol);
    try {
      await store.removeSymbol(symbol);
      universe.refetch();
    } catch {
      // store.error already carries the message for the banner below
    } finally {
      setPendingRemoval(null);
    }
  };

  const isStale = store.dataStatus === "delayed" || store.dataStatus === "cached";

  return (
    <div className="min-h-screen bg-paper">
      {isStale && (
        <div className="sticky top-0 z-50 bg-amber-300 text-amber-950 text-[13px] font-medium text-center py-2 px-4 shadow-sm">
          {store.dataStatus === "cached"
            ? "⚠️ Market data stream delayed. Displaying cached snapshot."
            : "⚠️ Market data stream delayed. Some tickers may be a few minutes behind."}
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white border-b border-black/5">
        <div className="max-w-6xl mx-auto px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-ink flex items-center justify-center">
              <span className="text-brand font-extrabold text-base leading-none">P</span>
            </div>
            <span className="text-[17px] font-bold tracking-tight text-ink">PulseWatch</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <SyncStatusPill status={store.dataStatus} lastSyncedAt={store.lastSyncedAt} />
            <span className="inline-flex items-center rounded-full bg-paper border border-black/10 px-3 py-1 text-[12.5px] font-medium text-ink-soft whitespace-nowrap shrink-0">
              {userId}
            </span>
            <button
              onClick={onLogout}
              className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:text-ink hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 transition-colors cursor-pointer shrink-0"
              title="Log out"
            >
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">
        {store.error && (
          <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[13px] px-4 py-3">
            {store.error}
          </div>
        )}

        <div className="inline-flex items-center rounded-full border border-black/10 bg-white p-1 mb-4 gap-1">
          <button
            onClick={() => setActiveTab("all")}
            aria-pressed={activeTab === "all"}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
              activeTab === "all" ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            All Stocks
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            aria-pressed={activeTab === "watchlist"}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
              activeTab === "watchlist" ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            My Watchlist
          </button>
        </div>

        {activeTab === "watchlist" && (
          <section className="mb-3">
            <form onSubmit={handleAddSymbol} className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <PlusIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  placeholder="Add symbol e.g. GOOGL"
                  aria-label="Add ticker symbol to watchlist"
                  className="w-full rounded-lg bg-white border border-black/10 text-[13.5px] pl-8 pr-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-shadow"
                />
              </div>
              <button
                type="submit"
                disabled={isAdding || !newSymbol.trim()}
                className="rounded-lg bg-ink hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold px-4 py-2 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1"
              >
                {isAdding ? "Adding…" : "Add to watchlist"}
              </button>
            </form>
            {addError && <p className="text-[12.5px] text-rose-600 mt-1.5">{addError}</p>}
          </section>
        )}

        {activeTab === "watchlist" ? (
          store.isLoading ? (
            <TableSkeleton />
          ) : (
            <WatchlistTable
              stocks={store.stocks}
              onRemove={handleRemoveSymbol}
              pendingRemoval={pendingRemoval}
              onSelect={setSelectedSymbol}
            />
          )
        ) : universe.isLoading ? (
          <TableSkeleton />
        ) : (
          <AllStocksTable
            stocks={universe.stocks}
            onAdd={handleAddFromUniverse}
            pendingAdd={pendingAdd}
            onRemove={handleRemoveSymbol}
            pendingRemoval={pendingRemoval}
            onSelect={setSelectedSymbol}
          />
        )}
      </main>

      {selectedSymbol && (
        <StockDetailModal
          symbol={selectedSymbol}
          token={token}
          onClose={() => setSelectedSymbol(null)}
          onUnauthorized={onLogout}
          inWatchlist={store.stocks.some((s) => s.symbol === selectedSymbol)}
          onAdd={handleAddFromUniverse}
          onRemove={handleRemoveSymbol}
          pendingWatchlistAction={pendingAdd === selectedSymbol || pendingRemoval === selectedSymbol}
        />
      )}
    </div>
  );
}
