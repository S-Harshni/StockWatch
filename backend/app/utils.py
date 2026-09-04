"""Small helpers shared across modules. Symbol validation used to be
duplicated inline in three places (SymbolRequest's field_validator, GET
/stocks/{symbol}, GET /stocks/{symbol}/insights) -- one copy here instead.

Two entry points because the two call sites need different exception
types: a pydantic field_validator only understands ValueError, while a
plain route handler body needs to raise HTTPException itself."""

from fastapi import HTTPException, status

from app.config import SYMBOL_PATTERN


def normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def validate_symbol(symbol: str) -> str:
    """Normalizes and validates a ticker. Raises ValueError -- use this
    inside a pydantic field_validator."""
    normalized = normalize_symbol(symbol)
    if not SYMBOL_PATTERN.match(normalized):
        raise ValueError("symbol must look like a ticker, e.g. AAPL or BRK.B")
    return normalized


def validate_symbol_or_400(symbol: str) -> str:
    """Same validation, but raises the 400 HTTPException a plain route
    handler needs instead of the ValueError a pydantic validator needs."""
    try:
        return validate_symbol(symbol)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
