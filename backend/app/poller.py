"""The background worker: fetches a live Finnhub quote per tracked symbol
every POLL_INTERVAL_SECONDS, runs it through scoring.py, and writes the
result into market_cache.MARKET_CACHE. Everything downstream (routes)
just reads that cache -- it never calls Finnhub directly."""

import asyncio
import logging
import time
from collections import deque
from datetime import datetime, timezone

from app.config import MAX_CONCURRENT_REQUESTS, POLL_INTERVAL_SECONDS, TREND_POINTS_MAX, finnhub_client
from app.market_cache import MARKET_CACHE, cache_lock, get_breaker
from app.scoring import apply_micro_fluctuation, calculate_attention_score, derive_context_tags, estimate_current_volume, mock_historical_stats
from app.watchlist_repository import get_all_tracked_symbols

logger = logging.getLogger("stockwatch.poller")

_request_semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
_price_history: dict[str, deque] = {}


def _fetch_quote_sync(symbol: str) -> dict:
    return finnhub_client.quote(symbol)


async def fetch_quote(symbol: str) -> dict:
    return await asyncio.to_thread(_fetch_quote_sync, symbol)


async def poll_symbol(symbol: str) -> None:
    breaker = get_breaker(symbol)

    if breaker.is_open:
        logger.warning("Circuit open for %s, skipping poll (serving stale cache)", symbol)
        async with cache_lock:
            existing = MARKET_CACHE.get(symbol, {"symbol": symbol})
            existing["is_stale"] = True
            MARKET_CACHE[symbol] = existing
        return

    try:
        async with _request_semaphore:
            quote = await fetch_quote(symbol)

        real_price = float(quote.get("c") or 0.0)

        if not real_price:
            raise ValueError(f"empty/invalid quote payload for {symbol}: {quote}")

        current_price = apply_micro_fluctuation(symbol, real_price)

        historical_avg_volume, moving_average, std_dev = mock_historical_stats(symbol, current_price)
        current_volume = estimate_current_volume(symbol, quote, historical_avg_volume)
        score_data = calculate_attention_score(current_price, current_volume, historical_avg_volume, moving_average, std_dev)
        context_tags = derive_context_tags(score_data["rvol"], score_data["z_score"], score_data["breakout"])

        history = _price_history.setdefault(symbol, deque(maxlen=TREND_POINTS_MAX))
        history.append(current_price)

        async with cache_lock:
            MARKET_CACHE[symbol] = {
                "symbol": symbol,
                "current_price": current_price,
                "current_volume": current_volume,
                "prev_close": float(quote.get("pc") or 0.0),
                "day_high": float(quote.get("h") or 0.0),
                "day_low": float(quote.get("l") or 0.0),
                "day_open": float(quote.get("o") or 0.0),
                "historical_avg_volume": historical_avg_volume,
                "mock_moving_average": moving_average,
                "mock_std_dev": std_dev,
                "trend_points": list(history),
                **score_data,
                "context_tags": context_tags,
                "is_stale": False,
                "last_updated": datetime.now(timezone.utc).isoformat(),
            }

        breaker.record_success()

    except Exception as exc:
        breaker.record_failure()
        logger.error("Failed to fetch quote for %s: %s", symbol, exc)
        async with cache_lock:
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
