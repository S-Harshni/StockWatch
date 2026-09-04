"""Company profile, peers, and recent news for the detail view's 'About
this company' section. Separate cache from market_cache.MARKET_CACHE, on
its own much longer TTL -- see config.INSIGHTS_CACHE_TTL_SECONDS."""

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

from app.config import INSIGHTS_CACHE_TTL_SECONDS, finnhub_client

logger = logging.getLogger("stockwatch.insights")

_insights_cache: dict[str, dict] = {}
_insights_lock = asyncio.Lock()


def _fetch_profile_sync(symbol: str) -> dict:
    return finnhub_client.company_profile2(symbol=symbol)


def _fetch_peers_sync(symbol: str) -> list:
    return finnhub_client.company_peers(symbol)


def _fetch_news_sync(symbol: str, from_date: str, to_date: str) -> list:
    return finnhub_client.company_news(symbol, _from=from_date, to=to_date)


async def fetch_company_insights(symbol: str) -> dict:
    """Company profile + peers + last 7 days of news, cached per-symbol.
    A failed upstream call degrades to empty sections rather than a hard
    error -- insights are supplementary to the price data, not required
    for the detail view to still be useful."""
    async with _insights_lock:
        cached = _insights_cache.get(symbol)
        if cached and (time.monotonic() - cached["fetched_at"]) < INSIGHTS_CACHE_TTL_SECONDS:
            return cached["data"]

    to_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    from_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

    try:
        profile, peers, news = await asyncio.gather(
            asyncio.to_thread(_fetch_profile_sync, symbol),
            asyncio.to_thread(_fetch_peers_sync, symbol),
            asyncio.to_thread(_fetch_news_sync, symbol, from_date, to_date),
        )
    except Exception as exc:
        logger.error("Failed to fetch insights for %s: %s", symbol, exc)
        profile, peers, news = {}, [], []

    data = {
        "profile": profile or {},
        "peers": [p for p in (peers or []) if p != symbol][:8],
        "news": (news or [])[:5],
    }

    async with _insights_lock:
        _insights_cache[symbol] = {"fetched_at": time.monotonic(), "data": data}

    return data
