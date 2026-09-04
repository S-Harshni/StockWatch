"""All tunable constants and the shared Finnhub client, in one place.
Every other module imports from here rather than hardcoding a value --
change a poll interval or a threshold once, not once per file."""

import os
import re

import finnhub
from dotenv import load_dotenv

load_dotenv()

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
if not FINNHUB_API_KEY:
    raise RuntimeError("FINNHUB_API_KEY not found in environment/.env file")

finnhub_client = finnhub.Client(api_key=FINNHUB_API_KEY)

DB_PATH = "stockwatch.db"

# --- Auth ---------------------------------------------------------------
JWT_SECRET = "stockwatch-hackathon-super-secret-key"
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 60 * 24 * 30  # a month -- this is a bearer token, not a session

SYMBOL_PATTERN = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")

# --- CORS -----------------------------------------------------------------
# Local Vite dev server. Loosen/replace for a real deployment.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
# --- Watchlist / universe ---------------------------------------------------
# Seed list every new user starts with.
DEFAULT_TICKERS = ["AAPL", "TSLA", "NVDA", "MSFT", "INFY"]

# Curated set shown on the "All Stocks" browse page. Always polled, whether
# or not any user has added them to a watchlist. Kept to ~25 names so a full
# poll cycle stays comfortably under Finnhub's free-tier ~60 req/min cap.
STOCK_UNIVERSE = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    "JPM", "V", "MA", "UNH", "HD", "PG", "JNJ", "COST",
    "ORCL", "NFLX", "ADBE", "CRM", "AMD",
    "PEP", "KO", "WMT", "DIS", "INFY",
]

# --- Polling ----------------------------------------------------------------
POLL_INTERVAL_SECONDS = 30

# Finnhub's free tier caps out around 60 req/min. Capping concurrency (rather
# than the interval) means the worker scales to more *unique* symbols across
# many users without needing config changes -- it just takes a little longer
# per cycle instead of tripping the rate limit.
MAX_CONCURRENT_REQUESTS = 5

CIRCUIT_FAILURE_THRESHOLD = 3
CIRCUIT_COOLDOWN_SECONDS = 60

# Rolling price-history length kept per symbol for the trend sparkline. At a
# 30s poll interval, 7-10 points is a ~3.5-5 minute trend -- real accumulated
# data from our own polling. Finnhub's free tier has no historical intraday
# candles (confirmed via a live 403 on /stock/candle), so this can't be
# backfilled; it builds up from the moment the server starts.
TREND_POINTS_MAX = 10

# If a real Finnhub quote comes back byte-identical to the previous poll
# (stale sandbox data / market closed), current_price would otherwise be
# perfectly flat forever -- flat deltas, flat sparklines. This caps how far
# the synthetic micro-walk (see scoring.apply_micro_fluctuation) can drift
# per poll.
MICRO_WALK_PCT = 0.0015  # +/- 0.15% per poll

# --- Company insights ---------------------------------------------------
# A company's profile/peers essentially never change intraday and news
# doesn't need per-poll freshness, so this is cached far longer than prices.
INSIGHTS_CACHE_TTL_SECONDS = 6 * 60 * 60  # 6h
