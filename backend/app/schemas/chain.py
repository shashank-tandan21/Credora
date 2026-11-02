from typing import Literal

from pydantic import BaseModel, Field


class ChainConfigResponse(BaseModel):
    demo_mode: bool
    chain_id: int
    network: Literal["sepolia", "hardhat-local", "unsupported"]
    rpc_configured: bool
    contracts_configured: bool
    confirmations: int
    contracts: dict[str, str | None]


class TransactionSyncRequest(BaseModel):
    transaction_hash: str = Field(pattern=r"^0x[a-fA-F0-9]{64}$")
