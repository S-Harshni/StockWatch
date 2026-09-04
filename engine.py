import asyncio
import json
import logging
import os
import sqlite3
import threading
import time
from collections import deque
from contextlib import closing
from datetime import datetime, timezone

import finnhub
from dotenv import load_dotenv

load_dotenv()

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
if not FINNHUB_API_KEY:
    raise RuntimeError("FINNHUB_API_KEY not found in environment/.env file")

finnhub_client = finnhub.Client(api_key=FINNHUB_API_KEY)

DB_PATH = "pulsewatch.db"

# Seed list every new user starts with.
DEFAULT_TICKERS = ["AAPL", "TSLA", "NVDA", "MSFT", "INFY"]

# Curated set shown on the "All Stocks" browse page. Always polled, whether
# or not any user has added them to a watchlist. Kept to ~25 names so a full
# poll cycle stays comfortably under Finnhub's free-tier ~60 req/min cap.
STOCK_UNIVERSE = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    "JPM", "V", "MA", "UNH", "HD", "PG", "JNJ", "COST",
    "ORCL", "NFLX", "ADBE", "CRM", "AMD",
    "PEP", "KO", "WMT", "DIS", "INFY",
]

POLL_INTERVAL_SECONDS = 30

# Finnhub's free tier caps out around 60 req/min. Capping concurrency (rather
# than the interval) means the worker scales to more *unique* symbols across
# many users without needing config changes -- it just takes a little longer
# per cycle instead of tripping the rate limit.
MAX_CONCURRENT_REQUESTS = 5

CIRCUIT_FAILURE_THRESHOLD = 3
CIRCUIT_COOLDOWN_SECONDS = 60

# Rolling price-history length kept per symbol for the trend sparkline. At a
# 30s poll interval, 7-10 points is a ~3.5-5 minute trend -- real accumulated
# data from our own polling. Finnhub's free tier has no historical intraday
# candles (confirmed via a live 403 on /stock/candle), so this can't be
# backfilled; it builds up from the moment the server starts. A quote that
# hasn't moved since the last poll produces a flat run in this series --
# that's genuine, not padded.
TREND_POINTS_MAX = 10

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pulsewatch.engine")

MARKET_CACHE: dict[str, dict] = {}
_cache_lock = asyncio.Lock()
_request_semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
_price_history: dict[str, deque] = {}

# SQLite writes happen inside asyncio.to_thread(), i.e. on real worker threads
# from the default executor -- so two concurrent requests (e.g. add + remove,
# or two users' /auth calls landing in the same tick) genuinely race on the
# same connection pool. A single process-wide lock serializes writes; SQLite's
# WAL mode still lets reads proceed concurrently and lock-free.
_db_write_lock = threading.Lock()


def normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def init_db(db_path: str = DB_PATH) -> None:
    with closing(sqlite3.connect(db_path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_snapshots (
                user_id TEXT NOT NULL,
                last_visited_at TEXT NOT NULL,
                market_snapshot TEXT NOT NULL,
                PRIMARY KEY (user_id, last_visited_at)
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_watchlists (
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (user_id, symbol)
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_stock_views (
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                viewed_at TEXT NOT NULL,
                snapshot TEXT NOT NULL,
                PRIMARY KEY (user_id, symbol)
            );
            """
        )
        conn.commit()


# --- User snapshots (state persistence across sessions/devices) -----------
# Snapshots are keyed by user_id, not device or browser session, and the JWT
# is stateless -- so logging in from a second device with the same user_id
# resumes the exact same "since you last checked" baseline.

def save_user_snapshot(user_id: str, snapshot: dict, db_path: str = DB_PATH) -> None:
    with _db_write_lock, closing(sqlite3.connect(db_path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute(
            "INSERT INTO user_snapshots (user_id, last_visited_at, market_snapshot) VALUES (?, ?, ?)",
            (user_id, datetime.now(timezone.utc).isoformat(), json.dumps(snapshot)),
        )
        conn.commit()


def get_latest_snapshot(user_id: str, db_path: str = DB_PATH) -> dict | None:
    with closing(sqlite3.connect(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT last_visited_at, market_snapshot FROM user_snapshots "
            "WHERE user_id = ? ORDER BY last_visited_at DESC LIMIT 1",
            (user_id,),
        ).fetchone()

    if row is None:
        return None

    return {
        "last_visited_at": row["last_visited_at"],
        "market_snapshot": json.loads(row["market_snapshot"]),
    }


# --- Per-stock view checkpoints ---------------------------------------------
# Separate from user_snapshots (which baselines the whole watchlist at
# login). This baselines a single symbol at the moment its detail view is
# opened, so reopening it later shows "since you last looked at *this*
# stock" rather than "since you last logged in."

def get_stock_views_for_user(user_id: str, db_path: str = DB_PATH) -> dict[str, dict]:
    """Batched read powering the "since you last checked" badge shown
    inline on the Watchlist/All Stocks rows -- one query for every symbol's
    checkpoint instead of one round trip per row."""
    with closing(sqlite3.connect(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT symbol, viewed_at, snapshot FROM user_stock_views WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    return {row["symbol"]: {"viewed_at": row["viewed_at"], "snapshot": json.loads(row["snapshot"])} for row in rows}


def get_stock_view(user_id: str, symbol: str, db_path: str = DB_PATH) -> dict | None:
    with closing(sqlite3.connect(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT viewed_at, snapshot FROM user_stock_views WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        ).fetchone()

    if row is None:
        return None

    return {"viewed_at": row["viewed_at"], "snapshot": json.loads(row["snapshot"])}


def save_stock_view(user_id: str, symbol: str, snapshot: dict, db_path: str = DB_PATH) -> None:
    with _db_write_lock, closing(sqlite3.connect(db_path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute(
            "INSERT OR REPLACE INTO user_stock_views (user_id, symbol, viewed_at, snapshot) VALUES (?, ?, ?, ?)",
            (user_id, symbol, datetime.now(timezone.utc).isoformat(), json.dumps(snapshot)),
        )
        conn.commit()


# --- User watchlists (create/manage) ---------------------------------------

def add_watchlist_symbol(user_id: str, symbol: str, db_path: str = DB_PATH) -> bool:
    symbol = normalize_symbol(symbol)
    with _db_write_lock, closing(sqlite3.connect(db_path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cur = conn.execute(
            "INSERT OR IGNORE INTO user_watchlists (user_id, symbol, added_at) VALUES (?, ?, ?)",
            (user_id, symbol, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        return cur.rowcount > 0


def remove_watchlist_symbol(user_id: str, symbol: str, db_path: str = DB_PATH) -> bool:
    symbol = normalize_symbol(symbol)
    with _db_write_lock, closing(sqlite3.connect(db_path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cur = conn.execute(
            "DELETE FROM user_watchlists WHERE user_id = ? AND symbol = ?",
            (user_id, symbol),
        )
        conn.commit()
        return cur.rowcount > 0


def get_watchlist_symbols(user_id: str, db_path: str = DB_PATH) -> list[str]:
    with closing(sqlite3.connect(db_path)) as conn:
        rows = conn.execute(
            "SELECT symbol FROM user_watchlists WHERE user_id = ? ORDER BY added_at ASC",
            (user_id,),
        ).fetchall()
    return [row[0] for row in rows]


def seed_default_watchlist(user_id: str, db_path: str = DB_PATH) -> list[str]:
    """Give first-time users a populated watchlist instead of a blank screen.
    Returns the symbols actually seeded (empty if this user already had a
    watchlist), so the caller knows which ones need a fresh "since you
    added it" checkpoint -- an existing user's checkpoints must not be
    touched just because they logged in again."""
    if get_watchlist_symbols(user_id, db_path=db_path):
        return []
    with _db_write_lock, closing(sqlite3.connect(db_path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        now = datetime.now(timezone.utc).isoformat()
        conn.executemany(
            "INSERT OR IGNORE INTO user_watchlists (user_id, symbol, added_at) VALUES (?, ?, ?)",
            [(user_id, symbol, now) for symbol in DEFAULT_TICKERS],
        )
        conn.commit()
    return list(DEFAULT_TICKERS)


def get_all_tracked_symbols(db_path: str = DB_PATH) -> list[str]:
    """Union of every user's watchlist and the browse-page universe --
    polled once per symbol regardless of how many users track it, so cost
    scales with unique symbols, not with user count."""
    with closing(sqlite3.connect(db_path)) as conn:
        rows = conn.execute("SELECT DISTINCT symbol FROM user_watchlists").fetchall()
    symbols = {row[0] for row in rows}
    symbols.update(DEFAULT_TICKERS)
    symbols.update(STOCK_UNIVERSE)
    return sorted(symbols)


# --- Circuit breaker --------------------------------------------------------

class CircuitBreaker:
    def __init__(self, failure_threshold: int = CIRCUIT_FAILURE_THRESHOLD, cooldown_seconds: int = CIRCUIT_COOLDOWN_SECONDS):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.failure_count = 0
        self.opened_at: float | None = None

    @property
    def is_open(self) -> bool:
        if self.opened_at is None:
            return False
        if time.monotonic() - self.opened_at >= self.cooldown_seconds:
            return False
        return True

    def record_success(self) -> None:
        self.failure_count = 0
        self.opened_at = None

    def record_failure(self) -> None:
        self.failure_count += 1
        if self.failure_count >= self.failure_threshold:
            self.opened_at = time.monotonic()


_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_breaker(symbol: str) -> CircuitBreaker:
    if symbol not in _circuit_breakers:
        _circuit_breakers[symbol] = CircuitBreaker()
    return _circuit_breakers[symbol]


# --- Data ingestion ----------------------------------------------------------

def _fetch_quote_sync(symbol: str) -> dict:
    return finnhub_client.quote(symbol)


async def fetch_quote(symbol: str) -> dict:
    return await asyncio.to_thread(_fetch_quote_sync, symbol)


async def poll_symbol(symbol: str) -> None:
    breaker = get_breaker(symbol)

    if breaker.is_open:
        logger.warning("Circuit open for %s, skipping poll (serving stale cache)", symbol)
        async with _cache_lock:
            existing = MARKET_CACHE.get(symbol, {"symbol": symbol})
            existing["is_stale"] = True
            MARKET_CACHE[symbol] = existing
        return

    try:
        async with _request_semaphore:
            quote = await fetch_quote(symbol)

        current_price = float(quote.get("c") or 0.0)

        if not current_price:
            raise ValueError(f"empty/invalid quote payload for {symbol}: {quote}")

        history = _price_history.setdefault(symbol, deque(maxlen=TREND_POINTS_MAX))
        history.append(current_price)

        async with _cache_lock:
            MARKET_CACHE[symbol] = {
                "symbol": symbol,
                "current_price": current_price,
                "prev_close": float(quote.get("pc") or 0.0),
                "day_high": float(quote.get("h") or 0.0),
                "day_low": float(quote.get("l") or 0.0),
                "day_open": float(quote.get("o") or 0.0),
                "trend_points": list(history),
                "is_stale": False,
                "last_updated": datetime.now(timezone.utc).isoformat(),
            }

        breaker.record_success()

    except Exception as exc:
        breaker.record_failure()
        logger.error("Failed to fetch quote for %s: %s", symbol, exc)
        async with _cache_lock:
            existing = MARKET_CACHE.get(symbol, {"symbol": symbol})
            existing["is_stale"] = True
            existing["last_error"] = str(exc)
            existing["last_error_at"] = datetime.now(timezone.utc).isoformat()
            MARKET_CACHE[symbol] = existing


async def poll_all_symbols() -> None:
    symbols = await asyncio.to_thread(get_all_tracked_symbols)
    await asyncio.gather(*(poll_symbol(symbol) for symbol in symbols))


async def market_watcher_worker(poll_interval: int = POLL_INTERVAL_SECONDS) -> None:
    logger.info("Starting market watcher worker (poll every %ss)", poll_interval)
    while True:
        start = time.monotonic()
        await poll_all_symbols()
        elapsed = time.monotonic() - start
        await asyncio.sleep(max(0.0, poll_interval - elapsed))


def get_market_snapshot() -> dict:
    return dict(MARKET_CACHE)


async def main() -> None:
    init_db()
    await market_watcher_worker()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down market watcher worker.")
