"""FastAPI app entrypoint. Just wiring here -- CORS, the lifespan-managed
background poller, and route registration. All actual logic lives in the
other modules under app/."""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import init_db
from app.poller import market_watcher_worker
from app.routes import auth, stocks, watchlist

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

_worker_task: Optional[asyncio.Task] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker_task
    init_db()
    _worker_task = asyncio.create_task(market_watcher_worker())
    yield
    if _worker_task:
        _worker_task.cancel()


app = FastAPI(title="StockWatch API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(watchlist.router)
app.include_router(stocks.router)
