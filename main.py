import asyncio
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, field_validator

from engine import (
    MARKET_CACHE,
    STOCK_UNIVERSE,
    _cache_lock,
    _circuit_breakers,
    add_watchlist_symbol,
    get_latest_snapshot,
    get_stock_view,
    get_stock_views_for_user,
    get_watchlist_symbols,
    init_db,
    market_watcher_worker,
    normalize_symbol,
    poll_symbol,
    remove_watchlist_symbol,
    save_stock_view,
    save_user_snapshot,
    seed_default_watchlist,
)

JWT_SECRET = "pulsewatch-hackathon-super-secret-key"
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 60 * 24 * 30  # a month -- this is a bearer token, not a session

SYMBOL_PATTERN = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")

security = HTTPBearer()
_worker_task: Optional[asyncio.Task] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker_task
    init_db()
    _worker_task = asyncio.create_task(market_watcher_worker())
    yield
    if _worker_task:
        _worker_task.cancel()


app = FastAPI(title="PulseWatch API", lifespan=lifespan)

# Local Vite dev server. Loosen/replace for a real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuthRequest(BaseModel):
    user_id: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SymbolRequest(BaseModel):
    symbol: str

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, value: str) -> str:
        normalized = normalize_symbol(value)
        if not SYMBOL_PATTERN.match(normalized):
            raise ValueError("symbol must look like a ticker, e.g. AAPL or BRK.B")
        return normalized


def create_jwt(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return user_id


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    return decode_jwt(credentials.credentials)


def compute_data_status(symbols: list[str]) -> str:
    if not symbols:
        return "live"
    relevant = [_circuit_breakers[s] for s in symbols if s in _circuit_breakers]
    open_count = sum(1 for breaker in relevant if breaker.is_open)
    if open_count == 0:
        return "live"
    if open_count >= len(symbols):
        return "cached"
    return "delayed"


def shape_stock(symbol: str, data: dict, compare_price: float | None = None) -> dict:
    """Builds one stock's entry in the API contract. `compare_price` is
    whatever baseline this endpoint measures change against -- the user's
    last-visit price for /watchlist, yesterday's close for /stocks -- and
    is left None where no baseline applies. Every field here comes straight
    from Finnhub's live quote; nothing is estimated or backfilled."""
    current_price = data.get("current_price", 0.0)
    prev_price = compare_price

    delta = None
    delta_percent = None
    if prev_price is not None:
        delta = round(current_price - prev_price, 4)
        if prev_price:
            delta_percent = round((delta / prev_price) * 100, 4)

    return {
        "symbol": symbol,
        "current_price": current_price,
        "previous_price": prev_price,
        "delta": delta,
        "delta_percent": delta_percent,
        "trend_points": data.get("trend_points", []),
        "open": data.get("day_open"),
        "high": data.get("day_high"),
        "low": data.get("day_low"),
        "prev_close": data.get("prev_close"),
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

    async with _cache_lock:
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
        stock = shape_stock(symbol, data, compare_price)
        attach_checked_delta(stock, stock["current_price"], stock_views.get(symbol))
        stocks.append(stock)

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
    async with _cache_lock:
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

    return {
        "data_status": compute_data_status(STOCK_UNIVERSE),
        "last_synced_at": newest_update,
        "stocks": stocks,
    }


@app.post("/auth", response_model=AuthResponse)
async def auth(request: AuthRequest):
    user_id = request.user_id.strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")

    token = create_jwt(user_id)

    seeded_symbols = await asyncio.to_thread(seed_default_watchlist, user_id)

    symbols = await asyncio.to_thread(get_watchlist_symbols, user_id)
    async with _cache_lock:
        snapshot = {symbol: dict(MARKET_CACHE[symbol]) for symbol in symbols if symbol in MARKET_CACHE}
    await asyncio.to_thread(save_user_snapshot, user_id, snapshot)

    # "Since you added it" starts counting from the moment a symbol first
    # lands on the watchlist -- for a brand-new user that's right now.
    for symbol in seeded_symbols:
        if symbol in snapshot:
            await asyncio.to_thread(save_stock_view, user_id, symbol, snapshot[symbol])

    return AuthResponse(access_token=token)


@app.get("/watchlist")
async def get_watchlist(user_id: str = Depends(get_current_user)):
    return await build_watchlist_payload(user_id)


@app.get("/stocks")
async def get_stocks(user_id: str = Depends(get_current_user)):
    symbols = await asyncio.to_thread(get_watchlist_symbols, user_id)
    return await build_stock_universe_payload(user_id, set(symbols))


@app.get("/stocks/{symbol}")
async def get_stock_detail(symbol: str, user_id: str = Depends(get_current_user)):
    """Powers the stock detail view. Compares the current price against the
    snapshot saved the *last* time this user opened this symbol's detail
    view (not the whole-watchlist last-visit baseline), then overwrites
    that snapshot with today's data so the next open compares against this
    one."""
    normalized = normalize_symbol(symbol)
    if not SYMBOL_PATTERN.match(normalized):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="symbol must look like a ticker, e.g. AAPL or BRK.B")

    if normalized not in MARKET_CACHE:
        # Any valid ticker can be opened, not just the curated/watchlisted
        # ones -- fetch it on demand so the detail view isn't limited to
        # what happens to already be warm in the cache.
        await poll_symbol(normalized)

    async with _cache_lock:
        data = dict(MARKET_CACHE.get(normalized, {"symbol": normalized, "is_stale": True}))

    if not data or data.get("current_price") is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No data available for {normalized}")

    previous_view = await asyncio.to_thread(get_stock_view, user_id, normalized)
    compare_price = previous_view["snapshot"].get("current_price") if previous_view else None

    detail = shape_stock(normalized, data, compare_price)
    detail["last_viewed_at"] = previous_view["viewed_at"] if previous_view else None

    watchlist_symbols = await asyncio.to_thread(get_watchlist_symbols, user_id)
    detail["in_watchlist"] = normalized in watchlist_symbols

    await asyncio.to_thread(save_stock_view, user_id, normalized, data)

    return detail


@app.post("/watchlist", status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(request: SymbolRequest, user_id: str = Depends(get_current_user)):
    symbol = request.symbol
    added = await asyncio.to_thread(add_watchlist_symbol, user_id, symbol)

    if added and symbol not in MARKET_CACHE:
        # Don't make the user wait for the next 30s poll cycle to see it.
        await poll_symbol(symbol)

    if added:
        # "Since you added it" starts counting from this moment, not from
        # whenever the user happens to first open the detail view.
        async with _cache_lock:
            data = dict(MARKET_CACHE[symbol]) if symbol in MARKET_CACHE else None
        if data:
            await asyncio.to_thread(save_stock_view, user_id, symbol, data)

    return await build_watchlist_payload(user_id)


@app.delete("/watchlist/{symbol}")
async def delete_from_watchlist(symbol: str, user_id: str = Depends(get_current_user)):
    normalized = normalize_symbol(symbol)
    await asyncio.to_thread(remove_watchlist_symbol, user_id, normalized)
    return await build_watchlist_payload(user_id)
