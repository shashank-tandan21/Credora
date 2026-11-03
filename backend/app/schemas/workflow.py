from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class RepaymentQuoteRequest(BaseModel):
    installment_number: int = Field(ge=1)


class RepaymentPrepareRequest(RepaymentQuoteRequest):
    idempotency_key: str = Field(min_length=8, max_length=128)


class RepaymentSyncRequest(BaseModel):
    status: Literal["confirmed", "failed"]
    transaction_hash: str | None = Field(default=None, pattern=r"^0x[a-fA-F0-9]{64}$")


class RepaymentResponse(BaseModel):
    id: UUID
    loan_id: UUID
    installment_number: int
    amount: float
    due_date: datetime
    status: Literal["prepared", "submitted", "pending", "confirmed", "failed", "overdue"]
    transaction_hash: str | None
    idempotency_key: str
    paid_at: datetime | None


class RecoveryRequestCreate(BaseModel):
    loan_id: UUID
    proposed_total: float = Field(gt=0)
    proposed_due_date: datetime
    reason: str = Field(min_length=10, max_length=2000)


class RecoveryMilestoneCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    amount: float = Field(gt=0)
    due_date: date


class RecoveryMilestoneResponse(BaseModel):
    id: UUID
    title: str
    amount: float
    due_date: date
    completed_at: datetime | None


class RecoveryRequestResponse(BaseModel):
    id: UUID
    loan_id: UUID
    proposed_total: float
    proposed_due_date: datetime
    reason: str
    status: Literal["submitted", "approved", "rejected", "completed", "cancelled"]
    created_at: datetime
    milestones: list[RecoveryMilestoneResponse]


class RecoveryProgressResponse(BaseModel):
    recovery_request_id: UUID
    completed_milestones: int
    total_milestones: int
    progress_percent: float


class DisputeCreate(BaseModel):
    assessment_id: UUID
    reason: str = Field(min_length=10, max_length=2000)


class DisputeResolve(BaseModel):
    status: Literal["rejected", "resolved_adjusted"]
    resolution_notes: str = Field(min_length=10, max_length=2000)


class DisputeResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    wallet_address: str
    reason: str
    status: Literal["open", "rejected", "resolved_adjusted"]
    resolution_notes: str | None
    resolved_by: str | None
    created_at: datetime
    resolved_at: datetime | None


class LenderPositionResponse(BaseModel):
    deposited_amount: float
    withdrawn_amount: float
    pool_share: float
    current_value: float


class PoolTransactionRequest(BaseModel):
    amount: float = Field(gt=0)
    idempotency_key: str = Field(min_length=8, max_length=128)


class PoolTransactionResponse(BaseModel):
    id: UUID
    transaction_type: Literal["deposit", "withdrawal"]
    amount: float
    status: Literal["prepared", "submitted", "pending", "confirmed", "failed"]
    transaction_hash: str | None
    idempotency_key: str
