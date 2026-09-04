"""Assembles the API-facing stock payloads from the various data sources
(market cache, snapshot repository, watchlist repository). This is the
layer routes call into -- it doesn't touch the DB or Finnhub directly."""

import asyncio

from app.config import STOCK_UNIVERSE
from app.market_cache import MARKET_CACHE, cache_lock, compute_data_status
from app.scoring import format_volume
from app.snapshot_repository import get_latest_snapshot, get_stock_views_for_user
from app.watchlist_repository import get_watchlist_symbols


def shape_stock(
    symbol: str,
    data: dict,
    compare_price: float | None = None,
    previous_attention_score: float | None = None,
) -> dict:
    """Builds one stock's entry in the API contract. `compare_price` is
    whatever baseline this endpoint measures change against -- the user's
    last-visit price for /watchlist, yesterday's close for /stocks -- and
    is left None where no baseline applies."""
    current_price = data.get("current_price", 0.0)
    prev_price = compare_price

    delta = None
    delta_percent = None
    if prev_price is not None:
        delta = round(current_price - prev_price, 4)
        if prev_price:
            delta_percent = round((delta / prev_price) * 100, 4)

    current_volume = data.get("current_volume")

    return {
        "symbol": symbol,
        "current_price": current_price,
        "previous_price": prev_price,
        "delta": delta,
        "delta_percent": delta_percent,
        "volume": format_volume(current_volume),
        "current_volume": current_volume,
        "attention_score": data.get("attention_score", 0.0),
        "previous_attention_score": previous_attention_score,
        "context_tags": data.get("context_tags", []),
        "trend_points": data.get("trend_points", []),
        "open": data.get("day_open"),
        "high": data.get("day_high"),
        "low": data.get("day_low"),
        "prev_close": data.get("prev_close"),
        "rvol": data.get("rvol"),
        "z_score": data.get("z_score"),
        "is_stale": data.get("is_stale", True),
        "last_updated": data.get("last_updated"),
    }


def attach_checked_delta(stock: dict, current_price: float, view_entry: dict | None) -> None:
    """Mutates `stock` in place with the "since you last checked" badge
    data shown inline on the list rows -- read-only against
    user_stock_views, unlike GET /stocks/{symbol} which also checkpoints."""
    if view_entry is None:
        stock["checked_at"] = None
        stock["checked_delta"] = None
        stock["checked_delta_percent"] = None
        return

    checked_price = view_entry["snapshot"].get("current_price")
    stock["checked_at"] = view_entry["viewed_at"]
    if checked_price is None:
        stock["checked_delta"] = None
        stock["checked_delta_percent"] = None
        return

    delta = round(current_price - checked_price, 4)
    stock["checked_delta"] = delta
    stock["checked_delta_percent"] = round((delta / checked_price) * 100, 4) if checked_price else None


async def build_watchlist_payload(user_id: str) -> dict:
    symbols = await asyncio.to_thread(get_watchlist_symbols, user_id)

    async with cache_lock:
        live_snapshot = {symbol: dict(data) for symbol, data in MARKET_CACHE.items()}

    last_snapshot = await asyncio.to_thread(get_latest_snapshot, user_id)
    last_visited_at = last_snapshot["last_visited_at"] if last_snapshot else None
    last_prices = last_snapshot["market_snapshot"] if last_snapshot else {}
    stock_views = await asyncio.to_thread(get_stock_views_for_user, user_id)

    stocks = []
    newest_update = None

    for symbol in symbols:
        data = live_snapshot.get(symbol, {"symbol": symbol, "is_stale": True})
        prev_entry = last_prices.get(symbol)

        last_updated = data.get("last_updated")
        if last_updated and (newest_update is None or last_updated > newest_update):
            newest_update = last_updated

        compare_price = prev_entry.get("current_price") if prev_entry else None
        previous_attention_score = prev_entry.get("attention_score") if prev_entry else None
        stock = shape_stock(symbol, data, compare_price, previous_attention_score)
        attach_checked_delta(stock, stock["current_price"], stock_views.get(symbol))
        stocks.append(stock)

    stocks.sort(key=lambda s: s["attention_score"] or 0.0, reverse=True)

    return {
        "data_status": compute_data_status(symbols),
        "last_synced_at": newest_update,
        "last_visited_at": last_visited_at,
        "stocks": stocks,
    }


async def build_stock_universe_payload(user_id: str, watchlist_symbols: set[str]) -> dict:
    """Powers the 'All Stocks' browse page: the curated universe list with
    live data, no per-user last-visit baseline (change is measured against
    today's previous close instead), plus whether each symbol is already on
    this user's watchlist so the row can show the right button state."""
    async with cache_lock:
        live_snapshot = {symbol: dict(MARKET_CACHE[symbol]) for symbol in STOCK_UNIVERSE if symbol in MARKET_CACHE}

    stock_views = await asyncio.to_thread(get_stock_views_for_user, user_id)

    stocks = []
    newest_update = None

    for symbol in sorted(STOCK_UNIVERSE):
        data = live_snapshot.get(symbol, {"symbol": symbol, "is_stale": True})
        last_updated = data.get("last_updated")
        if last_updated and (newest_update is None or last_updated > newest_update):
            newest_update = last_updated

        stock = shape_stock(symbol, data, compare_price=data.get("prev_close"))
        stock["in_watchlist"] = symbol in watchlist_symbols
        attach_checked_delta(stock, stock["current_price"], stock_views.get(symbol))
        stocks.append(stock)

    stocks.sort(key=lambda s: s["attention_score"] or 0.0, reverse=True)

    return {
        "data_status": compute_data_status(STOCK_UNIVERSE),
        "last_synced_at": newest_update,
        "stocks": stocks,
    }
