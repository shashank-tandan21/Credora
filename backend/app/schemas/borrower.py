from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BorrowerRegistrationRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=100)
    bio: str | None = Field(default=None, max_length=500)


class BorrowerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    wallet_address: str
    display_name: str
    bio: str | None
    identity_status: Literal["pending", "registered"]
    registration_transaction_hash: str | None
    created_at: datetime
