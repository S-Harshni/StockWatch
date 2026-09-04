# StockWatch

**A smart market watchlist that tells you what actually changed — not just what the price is.**

Built for the **CODE 2026** hackathon. Problem statement: build a smart watchlist that
surfaces what has *meaningfully* changed in a user's tracked stocks since they last
checked, instead of making them re-scan every ticker themselves. StockWatch is built
directly against the gaps in existing watchlist/alert products (Groww included): a
plain price list tells you *what*, but not *why it's worth your attention* or *what's
different since you looked last*.

<!-- Add a screenshot or short GIF of the dashboard here before submitting. -->

## The idea

Two things a normal watchlist doesn't do, that this one does:

1. **"Since you last checked" is a first-class concept, not an afterthought.** Every
   watchlist row and every stock detail view is compared against a snapshot saved the
   *last time this specific user looked at it* — not a generic 24h change. Log in
   after a few hours and the UI is already telling you what moved, not asking you to
   spot it.
2. **Attention Score ranks "worth looking at," not just "moved a lot."** It blends how
   unusual today's volume is for that stock (RVOL), how far price has drifted from its
   own recent average (z-score), and whether it broke out of its recent range — so a
   sleepy stock making a real move surfaces above a volatile stock doing its normal
   thing. The table sorts by this, not alphabetically or by raw % change.

## What's real data vs. estimated

Being upfront about this matters for a project judged on more than just the demo:

- **Real, live [Finnhub](https://finnhub.io) data:** current price, day open/high/low,
  previous close, the trend sparkline (built from our own polling history), company
  profile, peers, and recent news.
- **Estimated:** Finnhub's free tier doesn't expose historical intraday candles or
  trade volume (confirmed via a live 403 on `/stock/candle`), so Volume, RVOL,
  Attention Score, and the Signal tags (Breakout, Big Mover, etc.) are derived from
  the real price/range data that *is* available rather than left blank. The exact
  math is in `backend/app/scoring.py`, with the reasoning documented inline — nothing
  is silently faked.

## Features

- **Since You Were Away tracking** — per-symbol "last viewed" snapshots, not a single
  whole-account timestamp, so `delta_since_last_visit` means what it says on every
  screen (`snapshot_repository.py`).
- **Attention Score watchlist** — sorted by what's actually worth a look, with
  RVOL / z-score / breakout signals shown as plain-language tags (Volume Surge,
  Breakout, Big Mover, Momentum, Steady).
- **Curated "All Stocks" browse + personal watchlist** — add/remove any valid ticker;
  25 large-cap names are always polled so the browse tab is never empty.
- **Stock detail view** — full company profile, peers, and last 7 days of news
  (`backend/app/insights.py`), cached for hours since it doesn't need per-poll
  freshness.
- **Drag-to-reorder rows *and* columns** — touch-friendly via native Pointer Events,
  no drag-and-drop library.
- **Column picker** — show/hide/reorder optional columns, persisted per browser.
- **Bullish/bearish browser notifications** — fires once when a watchlisted stock
  *crosses* the Attention Score threshold in either direction, not on every poll it
  stays there (`useStockAlerts.js`).
- **Live data-status banner** — a sticky warning when the backend's per-symbol
  circuit breaker trips and data falls back to `delayed`/`cached`, so a stale demo
  never looks like a bug.
- **Dark/light theme**, optimistic add/remove with server resync on failure, and a
  request-id guard on the watchlist poller so an in-flight stale response can never
  clobber a fresher one.

## Project layout

```
backend/    FastAPI app (see backend/app/ below)
frontend/   React + Vite + Tailwind
```

**`backend/app/`** — one module per concern:

| Module | Responsibility |
|---|---|
| `main.py` | FastAPI app, CORS, lifespan-managed background poller, route registration |
| `config.py` | every tunable constant + the shared Finnhub client |
| `auth.py` | JWT issue/verify, `get_current_user` dependency |
| `database.py` | SQLite schema + the shared write lock |
| `watchlist_repository.py` | `user_watchlists` CRUD |
| `snapshot_repository.py` | `user_snapshots` + `user_stock_views` CRUD (the two "since you last looked" checkpoints) |
| `market_cache.py` | the live in-memory price cache + per-symbol circuit breaker |
| `scoring.py` | Volume / Attention Score / RVOL / Signals math (the estimated fields, fully documented) |
| `poller.py` | the background loop that fetches Finnhub quotes into the cache |
| `insights.py` | company profile / peers / news, cached separately (hours, not seconds) |
| `stock_service.py` | assembles the API-facing stock payloads from the above |
| `schemas.py` | request/response models |
| `utils.py` | symbol normalize/validate (one copy, used everywhere) |
| `routes/` | thin route handlers (`auth.py`, `watchlist.py`, `stocks.py`) that call into the modules above |

**`frontend/src/`** — key files:

| File | Responsibility |
|---|---|
| `App.jsx` | auth state (JWT in `localStorage`), login screen |
| `Dashboard.jsx` | page shell, header, tabs, stale-data banner |
| `WatchlistTable.jsx` / `AllStocksTable.jsx` | the two ticker tables |
| `StockDetailModal.jsx` | per-stock detail view (profile, peers, news, sparkline) |
| `ColumnPicker.jsx` / `useDragReorder.js` / `useColumnPrefs.js` | column show/hide + drag-reorder |
| `useWatchlistOrder.js` | row drag-reorder + persistence |
| `Sparkline.jsx` | trend chart from real polling history |
| `NotifierButton.jsx` / `useStockAlerts.js` / `useNotificationPermission.js` | bullish/bearish browser notifications |
| `SyncStatusPill.jsx` | live/delayed/cached indicator |
| `useWatchlistStore.js` / `useStockUniverse.js` | data fetching, polling, request-race guarding |
| `ThemeToggle.jsx` / `useTheme.js` | dark/light mode |

## API reference

All routes except `/auth` require `Authorization: Bearer <token>`.

| Method & path | Purpose |
|---|---|
| `POST /auth` | `{ "user_id": string }` → `{ access_token, token_type }`. Any non-empty user ID logs in (demo auth) and seeds a starter watchlist on first login. |
| `GET /watchlist` | This user's watchlist, sorted by Attention Score, with `delta_since_last_visit` per stock and overall `data_status`. |
| `POST /watchlist` | `{ "symbol": string }` — add a ticker to the watchlist. |
| `DELETE /watchlist/{symbol}` | Remove a ticker from the watchlist. |
| `GET /stocks` | The curated browse universe, flagged with which symbols are already watchlisted. |
| `GET /stocks/{symbol}` | Full detail for any valid ticker, compared against this user's last view of it. |
| `GET /stocks/{symbol}/insights` | Company profile, peers, and recent news. |

## Tech stack

**Backend:** FastAPI, Uvicorn, Pydantic v2, PyJWT, SQLite, [finnhub-python](https://github.com/Finnhub-Stock-API/finnhub-python), NumPy.
**Frontend:** React 18, Vite 5, Tailwind CSS 3, Framer Motion, native Notification API, native Pointer Events (no drag-and-drop dependency).

## Running it locally

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # then paste in your free Finnhub API key
uvicorn app.main:app --port 8000
```

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL and log in with any user ID — auth is a
demo token, not a real account system.

## Notes

- Finnhub's free tier caps out around 60 requests/minute; the curated universe
  (~25 tickers) is sized to stay under that with room to spare.
- `backend/stockwatch.db` is created automatically on first run and is gitignored —
  it's local runtime state, not something to commit.
- `backend/.env` (your real API key) is gitignored; only `backend/.env.example` is
  tracked. Never commit `.env`.

## License

No license file yet — add one (MIT is a common default for a hackathon submission)
if you want to explicitly state how others may reuse this code.

---

Built by Harshni for CODE 2026.
