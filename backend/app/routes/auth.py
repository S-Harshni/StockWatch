import asyncio

from fastapi import APIRouter, HTTPException, status

from app.auth import create_jwt
from app.market_cache import MARKET_CACHE, cache_lock
from app.schemas import AuthRequest, AuthResponse
from app.snapshot_repository import save_stock_view, save_user_snapshot
from app.watchlist_repository import get_watchlist_symbols, seed_default_watchlist

router = APIRouter()


@router.post("/auth", response_model=AuthResponse)
async def auth(request: AuthRequest):
    user_id = request.user_id.strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")

    token = create_jwt(user_id)

    seeded_symbols = await asyncio.to_thread(seed_default_watchlist, user_id)

    symbols = await asyncio.to_thread(get_watchlist_symbols, user_id)
    async with cache_lock:
        snapshot = {symbol: dict(MARKET_CACHE[symbol]) for symbol in symbols if symbol in MARKET_CACHE}
    await asyncio.to_thread(save_user_snapshot, user_id, snapshot)

    # "Since you added it" starts counting from the moment a symbol first
    # lands on the watchlist -- for a brand-new user that's right now.
    for symbol in seeded_symbols:
        if symbol in snapshot:
            await asyncio.to_thread(save_stock_view, user_id, symbol, snapshot[symbol])

    return AuthResponse(access_token=token)
