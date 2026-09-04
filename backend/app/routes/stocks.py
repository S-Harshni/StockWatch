import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.insights import fetch_company_insights
from app.market_cache import MARKET_CACHE, cache_lock
from app.poller import poll_symbol
from app.snapshot_repository import get_stock_view, save_stock_view
from app.stock_service import build_stock_universe_payload, shape_stock
from app.utils import validate_symbol_or_400
from app.watchlist_repository import get_watchlist_symbols

router = APIRouter()


@router.get("/stocks")
async def get_stocks(user_id: str = Depends(get_current_user)):
    symbols = await asyncio.to_thread(get_watchlist_symbols, user_id)
    return await build_stock_universe_payload(user_id, set(symbols))


@router.get("/stocks/{symbol}")
async def get_stock_detail(symbol: str, user_id: str = Depends(get_current_user)):
    """Powers the stock detail view. Compares the current price/attention
    score against the snapshot saved the *last* time this user opened this
    symbol's detail view (not the whole-watchlist last-visit baseline), then
    overwrites that snapshot with today's data so the next open compares
    against this one."""
    normalized = validate_symbol_or_400(symbol)

    if normalized not in MARKET_CACHE:
        # Any valid ticker can be opened, not just the curated/watchlisted
        # ones -- fetch it on demand so the detail view isn't limited to
        # what happens to already be warm in the cache.
        await poll_symbol(normalized)

    async with cache_lock:
        data = dict(MARKET_CACHE.get(normalized, {"symbol": normalized, "is_stale": True}))

    if not data or data.get("current_price") is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No data available for {normalized}")

    previous_view = await asyncio.to_thread(get_stock_view, user_id, normalized)
    compare_price = previous_view["snapshot"].get("current_price") if previous_view else None
    previous_attention_score = previous_view["snapshot"].get("attention_score") if previous_view else None

    detail = shape_stock(normalized, data, compare_price, previous_attention_score)
    detail["last_viewed_at"] = previous_view["viewed_at"] if previous_view else None

    watchlist_symbols = await asyncio.to_thread(get_watchlist_symbols, user_id)
    detail["in_watchlist"] = normalized in watchlist_symbols

    await asyncio.to_thread(save_stock_view, user_id, normalized, data)

    return detail


@router.get("/stocks/{symbol}/insights")
async def get_stock_insights(symbol: str, user_id: str = Depends(get_current_user)):
    """Company profile, peers, and recent news for the detail view's
    'About this company' section -- separate from the price polling loop
    since this data is cached for hours, not seconds."""
    normalized = validate_symbol_or_400(symbol)

    data = await fetch_company_insights(normalized)
    profile = data["profile"]

    return {
        "symbol": normalized,
        "name": profile.get("name"),
        "logo": profile.get("logo"),
        "industry": profile.get("finnhubIndustry"),
        "exchange": profile.get("exchange"),
        "country": profile.get("country"),
        "currency": profile.get("currency"),
        "ipo": profile.get("ipo"),
        "market_cap": profile.get("marketCapitalization"),
        "shares_outstanding": profile.get("shareOutstanding"),
        "website": profile.get("weburl"),
        "peers": data["peers"],
        "news": [
            {
                "headline": item.get("headline"),
                "source": item.get("source"),
                "summary": item.get("summary"),
                "url": item.get("url"),
                "image": item.get("image"),
                "datetime": item.get("datetime"),
            }
            for item in data["news"]
        ],
    }
