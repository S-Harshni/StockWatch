"""The in-memory live-price cache and the per-symbol circuit breaker that
protects it. Both are process-wide singletons imported by the poller (which
writes) and the routes (which read)."""

import asyncio
import time

from app.config import CIRCUIT_COOLDOWN_SECONDS, CIRCUIT_FAILURE_THRESHOLD

MARKET_CACHE: dict[str, dict] = {}
cache_lock = asyncio.Lock()


class CircuitBreaker:
    def __init__(self, failure_threshold: int = CIRCUIT_FAILURE_THRESHOLD, cooldown_seconds: int = CIRCUIT_COOLDOWN_SECONDS):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.failure_count = 0
        self.opened_at: float | None = None

    @property
    def is_open(self) -> bool:
        if self.opened_at is None:
            return False
        if time.monotonic() - self.opened_at >= self.cooldown_seconds:
            return False
        return True

    def record_success(self) -> None:
        self.failure_count = 0
        self.opened_at = None

    def record_failure(self) -> None:
        self.failure_count += 1
        if self.failure_count >= self.failure_threshold:
            self.opened_at = time.monotonic()


circuit_breakers: dict[str, CircuitBreaker] = {}


def get_breaker(symbol: str) -> CircuitBreaker:
    if symbol not in circuit_breakers:
        circuit_breakers[symbol] = CircuitBreaker()
    return circuit_breakers[symbol]


def compute_data_status(symbols: list[str]) -> str:
    """"live" if every polled symbol's circuit is closed, "cached" if all
    of them are open (serving stale data), "delayed" if it's a mix."""
    if not symbols:
        return "live"
    relevant = [circuit_breakers[s] for s in symbols if s in circuit_breakers]
    open_count = sum(1 for breaker in relevant if breaker.is_open)
    if open_count == 0:
        return "live"
    if open_count >= len(symbols):
        return "cached"
    return "delayed"
