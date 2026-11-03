from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.user import Base, User


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    principal_amount: Mapped[float] = mapped_column(Float)
    interest_rate: Mapped[float] = mapped_column(Float)
    interest_amount: Mapped[float] = mapped_column(Float)
    total_repayment: Mapped[float] = mapped_column(Float)
    duration_days: Mapped[int] = mapped_column(Integer)
    installments: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(20), default="requested")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    user: Mapped[User] = relationship()

    __table_args__ = (
        CheckConstraint("principal_amount > 0", name="ck_loans_principal_positive"),
        CheckConstraint("interest_amount >= 0", name="ck_loans_interest_nonnegative"),
        CheckConstraint("total_repayment >= principal_amount", name="ck_loans_total_not_below_principal"),
        CheckConstraint("duration_days > 0", name="ck_loans_duration_positive"),
    )
