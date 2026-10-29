from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from app.config import get_settings
from app.repositories.base import BaseRepository


@dataclass
class DemoUser:
    id: UUID
    wallet_address: str
    role: str
    created_at: datetime


@dataclass
class DemoBorrowerProfile:
    id: UUID
    user_id: UUID
    wallet_address: str
    display_name: str
    bio: str | None
    identity_status: str
    registration_transaction_hash: str | None
    created_at: datetime


@dataclass
class DemoEvidence:
    id: UUID
    wallet_address: str
    evidence_type: str
    period_months: int
    repayment_history_score: float
    affordability_score: float
    cash_flow_stability_score: float
    debt_burden_score: float
    evidence_quality_score: float
    notes: str | None
    created_at: datetime


@dataclass
class DemoAssessment:
    id: UUID
    wallet_address: str
    score: float
    risk_category: str
    components: list[dict[str, float | str]]
    explanation: list[str]
    valid_from: datetime
    expires_at: datetime
    status: str


@dataclass
class DemoLoan:
    id: UUID
    wallet_address: str
    principal_amount: float
    interest_rate: float
    interest_amount: float
    total_repayment: float
    duration_days: int
    installments: list[dict[str, int | str | float]]
    status: str
    created_at: datetime


@dataclass
class DemoStore:
    users_by_wallet: dict[str, DemoUser] = field(default_factory=dict)
    profiles_by_wallet: dict[str, DemoBorrowerProfile] = field(default_factory=dict)
    wallet_by_token: dict[str, str] = field(default_factory=dict)
    evidence_by_wallet: dict[str, list[DemoEvidence]] = field(default_factory=dict)
    assessments_by_wallet: dict[str, list[DemoAssessment]] = field(default_factory=dict)
    loans_by_wallet: dict[str, list[DemoLoan]] = field(default_factory=dict)
    pool_liquidity: float = 25_000.0
    pool_total_deposited: float = 30_000.0

    def get_or_create_user(self, wallet_address: str, role: str = "borrower") -> DemoUser:
        user = self.users_by_wallet.get(wallet_address)
        if user is None:
            user = DemoUser(
                id=uuid4(),
                wallet_address=wallet_address,
                role=role,
                created_at=datetime.now(UTC),
            )
            self.users_by_wallet[wallet_address] = user
        return user

    def create_token(self, wallet_address: str, token: str) -> None:
        self.wallet_by_token[token] = wallet_address


class DemoRepository(BaseRepository):
    def __init__(self) -> None:
        self.store = DemoStore()

    def get_or_create_user(self, wallet_address: str, role: str = "borrower") -> DemoUser:
        return self.store.get_or_create_user(wallet_address, role)

    def create_token(self, wallet_address: str, token: str) -> None:
        self.store.create_token(wallet_address, token)

    def get_user_for_token(self, token: str) -> str | None:
        return self.store.wallet_by_token.get(token)

    def get_profile(self, wallet_address: str) -> DemoBorrowerProfile | None:
        return self.store.profiles_by_wallet.get(wallet_address)

    def create_profile(self, profile: DemoBorrowerProfile) -> DemoBorrowerProfile:
        self.store.profiles_by_wallet[profile.wallet_address] = profile
        return profile

    def list_evidence(self, wallet_address: str) -> list[DemoEvidence]:
        return self.store.evidence_by_wallet.get(wallet_address, [])

    def save_evidence(self, wallet_address: str, evidence: DemoEvidence) -> DemoEvidence:
        self.store.evidence_by_wallet.setdefault(wallet_address, []).append(evidence)
        return evidence

    def current_assessment(self, wallet_address: str) -> DemoAssessment | None:
        assessments = self.store.assessments_by_wallet.get(wallet_address, [])
        return assessments[-1] if assessments else None

    def save_assessment(self, wallet_address: str, assessment: DemoAssessment) -> DemoAssessment:
        self.store.assessments_by_wallet.setdefault(wallet_address, []).append(assessment)
        return assessment

    def list_loans(self, wallet_address: str) -> list[DemoLoan]:
        return list(reversed(self.store.loans_by_wallet.get(wallet_address, [])))

    def save_loan(self, wallet_address: str, loan: DemoLoan) -> DemoLoan:
        self.store.loans_by_wallet.setdefault(wallet_address, []).append(loan)
        return loan

    def pool_statistics(self) -> dict[str, float | int]:
        loans = [loan for items in self.store.loans_by_wallet.values() for loan in items]
        outstanding = sum(loan.principal_amount for loan in loans)
        total_deposited = self.store.pool_total_deposited
        return {
            "total_pool_liquidity": round(self.store.pool_liquidity, 2),
            "total_deposited": round(total_deposited, 2),
            "total_active_loans": len(loans),
            "total_outstanding_principal": round(outstanding, 2),
            "utilization_rate": round(outstanding / total_deposited * 100, 2) if total_deposited else 0,
        }


_repository = DemoRepository()
demo_store = _repository.store


def get_repository() -> BaseRepository:
    settings = get_settings()
    if settings.demo_mode:
        return _repository
    from app.database import session_factory
    from app.repositories.postgres import PostgresRepository

    if session_factory is None:
        raise RuntimeError("Database sessions are unavailable in production mode.")
    return PostgresRepository(session_factory)
