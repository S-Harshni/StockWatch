import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import WatchlistTable from "./WatchlistTable";
import AllStocksTable from "./AllStocksTable";
import StockDetailModal from "./StockDetailModal";
import SyncStatusPill from "./SyncStatusPill";
import NotifierButton from "./NotifierButton";
import AmbientBackground from "./AmbientBackground";
import ThemeToggle from "./ThemeToggle";
import logo from "./logo.png";
import { useWatchlistStore } from "./useWatchlistStore";
import { useStockUniverse } from "./useStockUniverse";
import { useNotificationPermission } from "./useNotificationPermission";
import { useAlertsEnabled } from "./useAlertsEnabled";
import { useStockAlerts } from "./useStockAlerts";
import { PlusIcon, LogoutIcon } from "./icons";

function TableSkeleton() {
  return (
    <div
      className="rounded-xl border border-line bg-card shadow-card overflow-hidden"
      aria-busy="true"
      aria-label="Loading stocks"
    >
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex items-center gap-4 px-5 py-4 border-b border-line last:border-0 animate-pulse">
          <div className="h-3.5 w-14 rounded bg-card-alt" />
          <div className="h-3.5 w-16 rounded bg-card-alt ml-auto" />
          <div className="h-3.5 w-20 rounded bg-card-alt" />
          <div className="h-6 w-24 rounded bg-card-alt" />
          <div className="h-3.5 w-10 rounded bg-card-alt" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ token, userId, onLogout, theme, toggleTheme }) {
  const store = useWatchlistStore(token, onLogout);
  const universe = useStockUniverse(token, onLogout);
  const { permission, requestPermission, isSupported } = useNotificationPermission();
  const [alertsEnabled, toggleAlerts] = useAlertsEnabled();
  const alertsActive = permission === "granted" && alertsEnabled;
  useStockAlerts(store.stocks, alertsActive);

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
    <div className="min-h-screen">
      <AmbientBackground />
      {isStale && (
        <div className="sticky top-0 z-50 bg-amber-300 text-amber-950 text-[13px] font-medium text-center py-2 px-4 shadow-sm">
          {store.dataStatus === "cached"
            ? "⚠️ Market data stream delayed. Displaying cached snapshot."
            : "⚠️ Market data stream delayed. Some tickers may be a few minutes behind."}
        </div>
      )}

      <header className="sticky top-0 z-40 bg-card border-b border-line relative">
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-gold via-brand to-brand-dark" />
        <div className="max-w-6xl mx-auto px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-9 w-9 rounded-full overflow-hidden shrink-0 shadow-sm">
              <img src={logo} alt="" className="h-full w-full object-cover" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-ink">StockWatch</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <SyncStatusPill status={store.dataStatus} lastSyncedAt={store.lastSyncedAt} />
            <NotifierButton
              permission={permission}
              isSupported={isSupported}
              enabled={alertsEnabled}
              onEnable={requestPermission}
              onToggle={toggleAlerts}
            />
            <span className="inline-flex items-center rounded-full bg-card-alt border border-line px-3 py-1 text-[12.5px] font-medium text-ink-soft whitespace-nowrap shrink-0">
              {userId}
            </span>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <motion.button
              onClick={onLogout}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.12 }}
              className="h-8 w-8 rounded-full flex items-center justify-center text-ink-faint hover:text-ink hover:bg-card-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 transition-colors cursor-pointer shrink-0"
              title="Log out"
            >
              <LogoutIcon className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">
        {store.error && (
          <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[13px] px-4 py-3">
            {store.error}
          </div>
        )}

        <div className="inline-flex items-center rounded-full border border-line bg-card p-1 mb-4 gap-1">
          <motion.button
            onClick={() => setActiveTab("all")}
            aria-pressed={activeTab === "all"}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
              activeTab === "all" ? "bg-brand-dark text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            All Stocks
          </motion.button>
          <motion.button
            onClick={() => setActiveTab("watchlist")}
            aria-pressed={activeTab === "watchlist"}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
              activeTab === "watchlist" ? "bg-brand-dark text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            My Watchlist
          </motion.button>
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
                  className="w-full rounded-lg bg-card border border-line text-[13.5px] pl-8 pr-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-shadow"
                />
              </div>
              <motion.button
                type="submit"
                disabled={isAdding || !newSymbol.trim()}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold px-4 py-2 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1"
              >
                {isAdding ? "Adding…" : "Add to watchlist"}
              </motion.button>
            </form>
            {addError && <p className="text-[12.5px] text-rose-600 mt-1.5">{addError}</p>}
          </section>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
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
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedSymbol && (
          <StockDetailModal
            key="detail-modal"
            symbol={selectedSymbol}
            token={token}
            onClose={() => setSelectedSymbol(null)}
            onUnauthorized={onLogout}
            onSelectSymbol={setSelectedSymbol}
            inWatchlist={store.stocks.some((s) => s.symbol === selectedSymbol)}
            onAdd={handleAddFromUniverse}
            onRemove={handleRemoveSymbol}
            pendingWatchlistAction={pendingAdd === selectedSymbol || pendingRemoval === selectedSymbol}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
