from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class LoanQuoteRequest(BaseModel):
    amount: float = Field(gt=0, le=2000)
    duration_days: int = Field(ge=30, le=365)


class RepaymentInstallment(BaseModel):
    installment_number: int
    due_date: date
    amount: float
    status: Literal["scheduled", "paid", "overdue"] = "scheduled"


class LoanQuoteResponse(BaseModel):
    amount: float
    eligible_limit: float
    interest_rate: float
    interest_amount: float
    total_repayment: float
    duration_days: int
    installments: list[RepaymentInstallment]


class LoanRequestResponse(LoanQuoteResponse):
    id: UUID
    wallet_address: str
    status: Literal["requested", "approved", "disbursed", "active", "overdue", "repaid"] = (
        "requested"
    )
    created_at: datetime


class PoolStatisticsResponse(BaseModel):
    total_pool_liquidity: float
    total_deposited: float
    total_active_loans: int
    total_outstanding_principal: float
    utilization_rate: float


class LenderPositionResponse(BaseModel):
    deposited_amount: float
    withdrawn_amount: float
    pool_share: float
    current_value: float
