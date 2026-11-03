from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    CheckConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.user import Base, User


class TransactionStatus(StrEnum):
    PREPARED = "prepared"
    SUBMITTED = "submitted"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class PoolTransactionType(StrEnum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"


class PoolTransaction(Base):
    __tablename__ = "pool_transactions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    transaction_type: Mapped[str] = mapped_column(String(20))
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    status: Mapped[str] = mapped_column(String(20), default=TransactionStatus.PREPARED.value)
    transaction_hash: Mapped[str | None] = mapped_column(String(66), nullable=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_pool_transaction_idempotency"),
        Index("ix_pool_transactions_user_status", "user_id", "status"),
    )


class Repayment(Base):
    __tablename__ = "repayments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    loan_id: Mapped[UUID] = mapped_column(ForeignKey("loans.id"), index=True)
    borrower_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    installment_number: Mapped[int] = mapped_column(Integer)
    principal_amount: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    interest_amount: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=TransactionStatus.PREPARED.value)
    transaction_hash: Mapped[str | None] = mapped_column(String(66), nullable=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    borrower: Mapped[User] = relationship(foreign_keys=[borrower_id])

    __table_args__ = (
        UniqueConstraint("loan_id", "installment_number", name="uq_repayment_installment"),
        UniqueConstraint("borrower_id", "idempotency_key", name="uq_repayment_idempotency"),
        CheckConstraint("principal_amount >= 0", name="ck_repayments_principal_nonnegative"),
        CheckConstraint("interest_amount >= 0", name="ck_repayments_interest_nonnegative"),
        CheckConstraint("amount > 0", name="ck_repayments_amount_positive"),
        CheckConstraint("installment_number > 0", name="ck_repayments_installment_positive"),
    )


class RecoveryRequest(Base):
    __tablename__ = "recovery_requests"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    loan_id: Mapped[UUID] = mapped_column(ForeignKey("loans.id"), index=True)
    borrower_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    assessment_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("credit_assessments.id"), nullable=True, index=True
    )
    proposed_total: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    proposed_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="submitted")
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    borrower: Mapped[User] = relationship(foreign_keys=[borrower_id])
    milestones: Mapped[list["RecoveryMilestone"]] = relationship(
        cascade="all, delete-orphan", order_by="RecoveryMilestone.due_at"
    )

    __table_args__ = (
        CheckConstraint("proposed_total > 0", name="ck_recovery_total_positive"),
    )


class RecoveryMilestone(Base):
    __tablename__ = "recovery_milestones"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    recovery_request_id: Mapped[UUID] = mapped_column(
        ForeignKey("recovery_requests.id"), index=True
    )
    title: Mapped[str] = mapped_column(String(120))
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_recovery_milestone_amount_positive"),
    )


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    assessment_id: Mapped[UUID] = mapped_column(
        ForeignKey("credit_assessments.id"), index=True
    )
    borrower_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    borrower: Mapped[User] = relationship(foreign_keys=[borrower_id])
    resolver: Mapped[User | None] = relationship(foreign_keys=[resolved_by])

    __table_args__ = (
        Index("ix_disputes_borrower_status", "borrower_id", "status"),
    )


class AuditRecord(Base):
    __tablename__ = "audit_records"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100))
    resource_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[UUID] = mapped_column(index=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    key: Mapped[str] = mapped_column(String(128))
    operation: Mapped[str] = mapped_column(String(100))
    request_hash: Mapped[str] = mapped_column(String(64))
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "operation", "key", name="uq_idempotency_operation"),
    )
