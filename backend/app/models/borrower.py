from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


class IdentityStatus(StrEnum):
    PENDING = "pending"
    REGISTERED = "registered"


class BorrowerProfile(Base):
    __tablename__ = "borrower_profiles"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(100))
    identity_status: Mapped[str] = mapped_column(
        String(20), default=IdentityStatus.PENDING.value
    )
    registration_transaction_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
