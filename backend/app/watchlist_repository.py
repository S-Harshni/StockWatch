"""CRUD for the user_watchlists table -- who's tracking which symbol."""

import sqlite3
from contextlib import closing
from datetime import datetime, timezone

from app.config import DB_PATH, DEFAULT_TICKERS, STOCK_UNIVERSE
from app.database import db_write_lock
from app.utils import normalize_symbol


def add_watchlist_symbol(user_id: str, symbol: str, db_path: str = DB_PATH) -> bool:
    symbol = normalize_symbol(symbol)
    with db_write_lock, closing(sqlite3.connect(db_path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cur = conn.execute(
            "INSERT OR IGNORE INTO user_watchlists (user_id, symbol, added_at) VALUES (?, ?, ?)",
            (user_id, symbol, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        return cur.rowcount > 0


def remove_watchlist_symbol(user_id: str, symbol: str, db_path: str = DB_PATH) -> bool:
    symbol = normalize_symbol(symbol)
    with db_write_lock, closing(sqlite3.connect(db_path)) as conn:
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
    with db_write_lock, closing(sqlite3.connect(db_path)) as conn:
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
