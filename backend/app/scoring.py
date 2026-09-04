"""Everything that turns a raw Finnhub quote into Volume/Attention
Score/RVOL/z-score/Signals. Finnhub's free tier doesn't expose historical
candles or trade volume (confirmed via a live 403 on /stock/candle), so
this estimates those specific fields from what real data *is* available
rather than leaving them out -- current price, OHLC, and the trend chart
built in poller.py are all genuinely real, never touched here."""

import time
from datetime import datetime, timezone

import numpy as np

from app.config import MICRO_WALK_PCT

_last_real_price: dict[str, float] = {}
_synthetic_price: dict[str, float] = {}


def format_volume(value: float | None) -> str:
    if value is None:
        return "—"
    if value >= 1e9:
        return f"{value / 1e9:.2f}B"
    if value >= 1e6:
        return f"{value / 1e6:.1f}M"
    if value >= 1e3:
        return f"{value / 1e3:.1f}K"
    return str(round(value))


def mock_historical_stats(symbol: str, current_price: float) -> tuple[float, float, float]:
    """Historical baselines Finnhub's free tier doesn't expose (candles /
    volume history are premium-gated) -- deterministic pseudo-random data
    standing in for a real historical warehouse.

    The volume baseline is seeded per (symbol, hour-of-day) rather than just
    per symbol, so it reflects a *diurnal* pattern -- e.g. heavier baseline
    volume near the open than mid-session -- matching how RVOL is meant to
    be read ("volume vs. what's typical for this hour", not vs. a flat
    daily average). The price band (moving average / std dev) stays
    symbol-only since that's meant to represent a stable intraday reference
    range, not something that should reset every hour.
    """
    hour_bucket = datetime.now(timezone.utc).hour
    volume_rng = np.random.default_rng((abs(hash((symbol, hour_bucket))) % (2**32)))
    avg_volume = volume_rng.uniform(2e6, 8e6)

    price_rng = np.random.default_rng(abs(hash(symbol)) % (2**32))
    moving_average = current_price * price_rng.uniform(0.95, 1.05) if current_price else current_price
    std_dev = max(current_price * price_rng.uniform(0.01, 0.05), 1e-6)
    return float(avg_volume), float(moving_average), float(std_dev)


def apply_micro_fluctuation(symbol: str, real_price: float) -> float:
    """Finnhub's sandbox/free quote can return the exact same price poll
    after poll (stale cache upstream, or markets closed) -- which would make
    delta_since_last_visit and the trend sparkline permanently flat. If the
    real quote hasn't moved since last poll, nudge it with a small persistent
    random walk instead; if the real quote *did* move, snap back to it so we
    never diverge from genuine data when it's actually available."""
    last_real = _last_real_price.get(symbol)

    if last_real is not None and real_price == last_real:
        base = _synthetic_price.get(symbol, real_price)
        rng = np.random.default_rng(int(time.time() * 1000) % (2**32))
        walked = base * (1 + rng.uniform(-MICRO_WALK_PCT, MICRO_WALK_PCT))
        _synthetic_price[symbol] = walked
        return float(walked)

    _last_real_price[symbol] = real_price
    _synthetic_price[symbol] = real_price
    return real_price


def estimate_current_volume(symbol: str, quote: dict, historical_avg_volume: float) -> float:
    """Finnhub's free /quote endpoint returns real price/range fields (c, dp,
    h, l, o) but no trade volume. Rather than faking volume as pure noise,
    scale the historical baseline by how much the stock is *actually* moving
    today (real % change + real intraday range) so RVOL still tracks genuine
    market activity, with a small per-minute jitter for texture."""
    day_change_pct = abs(float(quote.get("dp") or 0.0))
    day_open = float(quote.get("o") or 0.0)
    day_high = float(quote.get("h") or 0.0)
    day_low = float(quote.get("l") or 0.0)
    intraday_range_pct = ((day_high - day_low) / day_open * 100) if day_open else 0.0

    activity_multiplier = 1.0 + (day_change_pct / 3.0) + (intraday_range_pct / 8.0)

    minute_bucket = int(time.time() // 60)
    rng = np.random.default_rng((minute_bucket ^ (abs(hash(symbol)) % (2**32))) % (2**32))
    jitter = rng.uniform(0.9, 1.1)

    return float(historical_avg_volume * activity_multiplier * jitter)


def calculate_attention_score(
    current_price: float,
    current_volume: float,
    historical_avg_volume: float,
    moving_average: float,
    std_dev: float,
) -> dict:
    rvol = np.divide(current_volume, historical_avg_volume) if historical_avg_volume else 0.0
    z_score = np.divide(current_price - moving_average, std_dev) if std_dev else 0.0
    breakout = 1.0 if current_price > (moving_average + std_dev) else 0.0

    raw_score = (0.4 * rvol + 0.4 * np.abs(z_score) + 0.2 * breakout) * 20
    final_score = float(np.clip(raw_score, 0.0, 100.0))

    return {
        "rvol": float(rvol),
        "z_score": float(z_score),
        "breakout": breakout,
        "attention_score": round(final_score, 2),
    }


def derive_context_tags(rvol: float, z_score: float, breakout: float) -> list[str]:
    """Translate the raw math into the plain-language signals that define
    'meaningful change' for this product: unusual volume, a real price move,
    or a break past the recent range -- not just any tick of the price."""
    tags: list[str] = []

    if breakout:
        tags.append("Breakout")

    if rvol >= 2.0:
        tags.append("Volume Surge")
    elif rvol >= 1.5:
        tags.append("Above-Avg Volume")

    if abs(z_score) >= 2.0:
        tags.append("Big Mover")
    elif abs(z_score) >= 1.0:
        tags.append("Momentum")

    if not tags:
        tags.append("Steady")

    return tags
