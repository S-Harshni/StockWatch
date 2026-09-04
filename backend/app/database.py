"""Schema setup and the one write lock every repository module shares.

SQLite writes happen inside asyncio.to_thread(), i.e. on real worker threads
from the default executor -- so two concurrent requests (e.g. add + remove,
or two users' /auth calls landing in the same tick) genuinely race on the
same connection pool. A single process-wide lock serializes writes; SQLite's
WAL mode still lets reads proceed concurrently and lock-free.
"""

import sqlite3
import threading
from contextlib import closing

from app.config import DB_PATH

db_write_lock = threading.Lock()


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
