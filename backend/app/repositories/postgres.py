from __future__ import annotations

import hashlib
from collections.abc import Callable
from datetime import UTC, datetime
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AuthSession,
    BorrowerProfile,
    CreditAssessment,
    FinancialEvidence,
    Loan,
    PoolTransaction,
    User,
)
from app.repositories.base import BaseRepository


class PostgresRepository(BaseRepository):
    """Persistence repository backed by an injected async SQLAlchemy session factory."""

    def __init__(self, session_factory: Callable[[], AsyncSession]) -> None:
        self.session_factory = session_factory

    async def get_or_create_user(self, wallet_address: str, role: str = "borrower") -> User:
        normalized_address = wallet_address.lower()
        async with self.session_factory() as session:
            user = await session.scalar(
                select(User).where(User.wallet_address == normalized_address)
            )
            if user is None:
                user = User(wallet_address=normalized_address, role=role)
                session.add(user)
                await session.commit()
                await session.refresh(user)
            return user

    async def create_token(self, wallet_address: str, token: str) -> None:
        token_hash = self._hash_token(token)
        async with self.session_factory() as session:
            user = await session.scalar(
                select(User).where(User.wallet_address == wallet_address.lower())
            )
            if user is None:
                raise ValueError("Cannot create a token for an unknown wallet.")
            session.add(
                AuthSession(
                    user_id=user.id,
                    token_hash=token_hash,
                    expires_at=datetime.max.replace(tzinfo=UTC),
                )
            )
            await session.commit()

    async def get_user_for_token(self, token: str) -> str | None:
        async with self.session_factory() as session:
            result = await session.execute(
                select(User.wallet_address, AuthSession.expires_at)
                .join(AuthSession, AuthSession.user_id == User.id)
                .where(
                    AuthSession.token_hash == self._hash_token(token),
                    AuthSession.revoked_at.is_(None),
                )
            )
            row = result.first()
            if row is None or row.expires_at <= datetime.now(UTC):
                return None
            return row.wallet_address

    async def get_profile(self, wallet_address: str) -> BorrowerProfile | None:
        async with self.session_factory() as session:
            return await session.scalar(
                select(BorrowerProfile)
                .join(User, BorrowerProfile.user_id == User.id)
                .where(User.wallet_address == wallet_address.lower())
            )

    async def create_profile(self, profile: BorrowerProfile) -> BorrowerProfile:
        async with self.session_factory() as session:
            session.add(profile)
            await session.commit()
            await session.refresh(profile)
            return profile

    async def list_evidence(self, wallet_address: str) -> list[FinancialEvidence]:
        async with self.session_factory() as session:
            result = await session.scalars(
                select(FinancialEvidence)
                .join(User, FinancialEvidence.user_id == User.id)
                .where(User.wallet_address == wallet_address.lower())
                .order_by(FinancialEvidence.created_at.desc())
            )
            return list(result.all())

    async def save_evidence(
        self, wallet_address: str, evidence: FinancialEvidence
    ) -> FinancialEvidence:
        user = await self.get_or_create_user(wallet_address)
        evidence.user_id = user.id
        async with self.session_factory() as session:
            session.add(evidence)
            await session.commit()
            await session.refresh(evidence)
            return evidence

    async def current_assessment(self, wallet_address: str) -> CreditAssessment | None:
        async with self.session_factory() as session:
            return await session.scalar(
                select(CreditAssessment)
                .join(User, CreditAssessment.user_id == User.id)
                .where(User.wallet_address == wallet_address.lower())
                .order_by(CreditAssessment.created_at.desc())
                .limit(1)
            )

    async def save_assessment(
        self, wallet_address: str, assessment: CreditAssessment
    ) -> CreditAssessment:
        user = await self.get_or_create_user(wallet_address)
        assessment.user_id = user.id
        async with self.session_factory() as session:
            session.add(assessment)
            await session.commit()
            await session.refresh(assessment)
            return assessment

    async def list_loans(self, wallet_address: str) -> list[Loan]:
        async with self.session_factory() as session:
            result = await session.scalars(
                select(Loan)
                .join(User, Loan.user_id == User.id)
                .where(User.wallet_address == wallet_address.lower())
                .order_by(Loan.created_at.desc())
            )
            return list(result.all())

    async def save_loan(self, wallet_address: str, loan: Loan) -> Loan:
        user = await self.get_or_create_user(wallet_address)
        loan.user_id = user.id
        async with self.session_factory() as session:
            session.add(loan)
            await session.commit()
            await session.refresh(loan)
            return loan

    async def pool_statistics(self) -> dict[str, float | int]:
        async with self.session_factory() as session:
            total_deposited = await session.scalar(
                select(func.coalesce(func.sum(PoolTransaction.amount), 0.0)).where(
                    PoolTransaction.transaction_type == "deposit",
                    PoolTransaction.status == "confirmed",
                )
            )
            total_withdrawn = await session.scalar(
                select(func.coalesce(func.sum(PoolTransaction.amount), 0.0)).where(
                    PoolTransaction.transaction_type == "withdrawal",
                    PoolTransaction.status == "confirmed",
                )
            )
            outstanding = await session.scalar(
                select(
                    func.coalesce(
                        func.sum(Loan.principal_amount),
                        0.0,
                    )
                ).where(Loan.status.in_(("requested", "approved", "disbursed", "active", "overdue")))
            )
            active_loans = await session.scalar(
                select(func.count(Loan.id)).where(
                    Loan.status.in_(("requested", "approved", "disbursed", "active", "overdue"))
                )
            )
            deposited = float(total_deposited or 0)
            withdrawn = float(total_withdrawn or 0)
            principal = float(outstanding or 0)
            return {
                "total_pool_liquidity": round(max(deposited - withdrawn - principal, 0), 2),
                "total_deposited": round(deposited, 2),
                "total_active_loans": int(active_loans or 0),
                "total_outstanding_principal": round(principal, 2),
                "utilization_rate": round(principal / deposited * 100, 2) if deposited else 0,
            }

    async def revoke_token(self, token: str) -> bool:
        async with self.session_factory() as session:
            auth_session = await session.scalar(
                select(AuthSession).where(
                    AuthSession.token_hash == self._hash_token(token),
                    AuthSession.revoked_at.is_(None),
                )
            )
            if auth_session is None:
                return False
            auth_session.revoked_at = datetime.now(UTC)
            await session.commit()
            return True

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()
