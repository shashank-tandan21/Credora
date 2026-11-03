from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class FinancialEvidence(Base):
    __tablename__ = "financial_evidence"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    evidence_type: Mapped[str] = mapped_column(String(50))
    period_months: Mapped[int] = mapped_column(Integer)
    repayment_history_score: Mapped[float] = mapped_column(Float)
    affordability_score: Mapped[float] = mapped_column(Float)
    cash_flow_stability_score: Mapped[float] = mapped_column(Float)
    debt_burden_score: Mapped[float] = mapped_column(Float)
    evidence_quality_score: Mapped[float] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CreditAssessment(Base):
    __tablename__ = "credit_assessments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    score: Mapped[float] = mapped_column(Float)
    risk_category: Mapped[str] = mapped_column(String(30))
    explanation: Mapped[str] = mapped_column(Text)
    components: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(20), default="active")
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
