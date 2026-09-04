# PulseWatch

A live stock watchlist. Browse a curated set of tickers, add the ones you care
about to a personal watchlist, open any stock for a detail view, and drag
rows/columns into whatever order suits you.

All price data is real, live [Finnhub](https://finnhub.io) quotes — nothing
in this app is simulated or backfilled. Finnhub's free tier doesn't expose
historical candles or trade volume, so this app only shows what it can back
with genuine data: current price, day open/high/low, previous close, and a
trend built from its own polling history.

## Architecture

- **Backend** (`main.py`, `engine.py`) — FastAPI + a background asyncio
  worker that polls Finnhub every 30s for a curated universe of ~25 tickers
  plus whatever's on any user's watchlist, with a per-symbol circuit breaker
  so one failing ticker doesn't take down the rest. SQLite (`pulsewatch.db`)
  persists watchlists and two kinds of "since you last looked" checkpoints:
  one for the whole watchlist (taken at login) and one per symbol (taken
  when its detail view opens, or the moment it's added).
- **Frontend** (`src/`) — React + Vite + Tailwind. Two views (All Stocks,
  My Watchlist) sharing one live-data hook per table, a detail modal, and
  drag-to-reorder for both rows and columns (built on Pointer Events, so it
  works on touch as well as mouse).

## Running it

**Backend**

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # then paste in your Finnhub API key
uvicorn main:app --port 8000
```

**Frontend** (in a second terminal)

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL and log in with any user ID —
auth is a demo token, not a real account system.

## Notes

- Finnhub's free tier caps out around 60 requests/minute; the curated
  universe is sized to stay under that with room to spare.
- `pulsewatch.db` is created automatically on first run and is gitignored —
  it's local runtime state, not something to commit.
