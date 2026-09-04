"""Request/response body models."""

from pydantic import BaseModel, field_validator

from app.utils import validate_symbol


class AuthRequest(BaseModel):
    user_id: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SymbolRequest(BaseModel):
    symbol: str

    @field_validator("symbol")
    @classmethod
    def validate(cls, value: str) -> str:
        return validate_symbol(value)
