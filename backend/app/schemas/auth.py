from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class NonceRequest(BaseModel):
    wallet_address: str = Field(pattern=r"^0x[a-fA-F0-9]{40}$")


class NonceResponse(BaseModel):
    wallet_address: str
    nonce: str
    message: str
    expires_at: datetime


class VerifySignatureRequest(BaseModel):
    wallet_address: str = Field(pattern=r"^0x[a-fA-F0-9]{40}$")
    nonce: str = Field(min_length=16, max_length=128)
    signature: str = Field(min_length=8, max_length=1024)
    message: str | None = Field(default=None, max_length=2048)


class AuthenticatedUser(BaseModel):
    model_config = ConfigDict(frozen=True)

    wallet_address: str
    role: Literal["borrower", "lender", "reviewer", "admin"]
    demo_mode: bool


class VerifySignatureResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: AuthenticatedUser
