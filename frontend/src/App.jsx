import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Dashboard from "./Dashboard";
import AmbientBackground from "./AmbientBackground";
import ThemeToggle from "./ThemeToggle";
import { useTheme } from "./useTheme";
import logo from "./logo.png";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [token, setToken] = useState(() => localStorage.getItem("stockwatch_token"));
  const [userId, setUserId] = useState(() => localStorage.getItem("stockwatch_user") || "");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem("stockwatch_token", token);
      localStorage.setItem("stockwatch_user", userId);
    } else {
      localStorage.removeItem("stockwatch_token");
    }
  }, [token, userId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!userId.trim()) return;

    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Login failed (${res.status})`);
      }

      const data = await res.json();
      setToken(data.access_token);
    } catch (err) {
      setAuthError(
        err instanceof TypeError
          ? "Can't reach the StockWatch server. Is the backend running on :8000?"
          : err.message
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
  };

  if (!token) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-4">
        <AmbientBackground />
        <div className="fixed top-4 right-4">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <motion.div
          className="w-full max-w-[380px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex items-center gap-2 justify-center mb-8">
            <div className="h-11 w-11 rounded-full overflow-hidden shrink-0 shadow-sm">
              <img src={logo} alt="" className="h-full w-full object-cover" />
            </div>
            <span className="text-xl font-bold tracking-tight text-ink">StockWatch</span>
          </div>

          <form onSubmit={handleLogin} className="bg-card border border-line rounded-2xl shadow-card p-7">
            <h1 className="text-[15px] font-semibold text-ink mb-1">Log in to your watchlist</h1>
            <p className="text-[13px] text-ink-faint mb-6">
              Pick up right where you left off — we remember what changed.
            </p>

            <label className="block text-[12px] font-medium text-ink-soft mb-1.5" htmlFor="user_id">
              User ID
            </label>
            <input
              id="user_id"
              type="text"
              autoFocus
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. trader_01"
              className="w-full rounded-lg bg-paper border border-line text-ink text-[14px] px-3.5 py-2.5 mb-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-shadow"
            />

            {authError && (
              <p className="text-[12.5px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-4">
                {authError}
              </p>
            )}

            <motion.button
              type="submit"
              disabled={isLoggingIn || !userId.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-semibold py-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
            >
              {isLoggingIn ? "Logging in…" : "Continue"}
            </motion.button>
          </form>

          <p className="text-center text-[11.5px] text-ink-faint mt-5">
            Demo auth — any user ID logs you in. First login seeds a starter watchlist.
          </p>
        </motion.div>
      </div>
    );
  }

  return <Dashboard token={token} userId={userId} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />;
}
