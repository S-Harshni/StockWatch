import asyncio

from fastapi import APIRouter, Depends, status

from app.auth import get_current_user
from app.market_cache import MARKET_CACHE, cache_lock
from app.poller import poll_symbol
from app.schemas import SymbolRequest
from app.snapshot_repository import save_stock_view
from app.stock_service import build_watchlist_payload
from app.utils import normalize_symbol
from app.watchlist_repository import add_watchlist_symbol, remove_watchlist_symbol

router = APIRouter()


@router.get("/watchlist")
async def get_watchlist(user_id: str = Depends(get_current_user)):
    return await build_watchlist_payload(user_id)


@router.post("/watchlist", status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(request: SymbolRequest, user_id: str = Depends(get_current_user)):
    symbol = request.symbol
    added = await asyncio.to_thread(add_watchlist_symbol, user_id, symbol)

    if added and symbol not in MARKET_CACHE:
        # Don't make the user wait for the next 30s poll cycle to see it.
        await poll_symbol(symbol)

    if added:
        # "Since you added it" starts counting from this moment, not from
        # whenever the user happens to first open the detail view.
        async with cache_lock:
            data = dict(MARKET_CACHE[symbol]) if symbol in MARKET_CACHE else None
        if data:
            await asyncio.to_thread(save_stock_view, user_id, symbol, data)

    return await build_watchlist_payload(user_id)


@router.delete("/watchlist/{symbol}")
async def delete_from_watchlist(symbol: str, user_id: str = Depends(get_current_user)):
    normalized = normalize_symbol(symbol)
    await asyncio.to_thread(remove_watchlist_symbol, user_id, normalized)
    return await build_watchlist_payload(user_id)
