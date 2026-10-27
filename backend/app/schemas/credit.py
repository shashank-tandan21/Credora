from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class EvidenceSubmissionRequest(BaseModel):
    evidence_type: str = Field(min_length=2, max_length=50)
    period_months: int = Field(ge=1, le=60)
    repayment_history_score: float = Field(ge=0, le=100)
    affordability_score: float = Field(ge=0, le=100)
    cash_flow_stability_score: float = Field(ge=0, le=100)
    debt_burden_score: float = Field(ge=0, le=100)
    evidence_quality_score: float = Field(ge=0, le=100)
    notes: str | None = Field(default=None, max_length=1000)


class EvidenceResponse(EvidenceSubmissionRequest):
    id: UUID
    created_at: datetime


class ScoreComponent(BaseModel):
    name: str
    raw_score: float
    weight: float
    contribution: float


class CreditAssessmentResponse(BaseModel):
    id: UUID
    score: float
    risk_category: Literal["High risk", "Moderate risk", "Fair", "Good", "Strong"]
    components: list[ScoreComponent]
    explanation: list[str]
    academic_model: bool
    valid_from: datetime
    expires_at: datetime
    status: Literal["active", "expired", "disputed"]


class CreditAssessmentRequest(BaseModel):
    validity_days: int = Field(default=90, ge=1, le=365)
