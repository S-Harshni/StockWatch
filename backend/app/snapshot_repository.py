"""CRUD for the two kinds of "since you last looked" checkpoints:

- user_snapshots: the whole watchlist, baselined once at login. Keyed by
  user_id (not device/browser session) so logging in from a second device
  with the same user_id resumes the exact same baseline.
- user_stock_views: a single symbol, baselined the moment its detail view
  opens (or the moment it's added to the watchlist) -- independent of the
  whole-watchlist snapshot above.
"""

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

from app.config import DB_PATH
from app.database import db_write_lock


def save_user_snapshot(user_id: str, snapshot: dict, db_path: str = DB_PATH) -> None:
    with db_write_lock, closing(sqlite3.connect(db_path)) as conn:
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
    with db_write_lock, closing(sqlite3.connect(db_path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute(
            "INSERT OR REPLACE INTO user_stock_views (user_id, symbol, viewed_at, snapshot) VALUES (?, ?, ?, ?)",
            (user_id, symbol, datetime.now(timezone.utc).isoformat(), json.dumps(snapshot)),
        )
        conn.commit()
