from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from app.config import get_settings
from app.models import AuditRecord
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
class DemoRepayment:
    id: UUID
    loan_id: UUID
    wallet_address: str
    installment_number: int
    amount: float
    due_date: datetime
    status: str
    transaction_hash: str | None
    idempotency_key: str
    created_at: datetime
    paid_at: datetime | None = None


@dataclass
class DemoRecoveryRequest:
    id: UUID
    loan_id: UUID
    wallet_address: str
    proposed_total: float
    proposed_due_date: datetime
    reason: str
    status: str
    created_at: datetime
    milestones: list[dict[str, object]] = field(default_factory=list)


@dataclass
class DemoDispute:
    id: UUID
    assessment_id: UUID
    wallet_address: str
    reason: str
    status: str
    resolution_notes: str | None
    resolved_by: str | None
    created_at: datetime
    resolved_at: datetime | None = None


@dataclass
class DemoLenderPosition:
    wallet_address: str
    deposited_amount: float = 0
    withdrawn_amount: float = 0
    pool_share: float = 0
    current_value: float = 0


@dataclass
class DemoPoolTransaction:
    id: UUID
    wallet_address: str
    transaction_type: str
    amount: float
    status: str
    transaction_hash: str | None
    idempotency_key: str


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
    repayments_by_loan: dict[UUID, list[DemoRepayment]] = field(default_factory=dict)
    recovery_requests: dict[UUID, DemoRecoveryRequest] = field(default_factory=dict)
    disputes: dict[UUID, DemoDispute] = field(default_factory=dict)
    lender_positions: dict[str, DemoLenderPosition] = field(default_factory=dict)
    pool_transactions: dict[tuple[str, str], DemoPoolTransaction] = field(default_factory=dict)

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

    def get_lender_position(self, wallet_address: str) -> DemoLenderPosition:
        key = wallet_address.lower()
        position = self.store.lender_positions.get(key)
        if position is None:
            position = DemoLenderPosition(wallet_address=key)
            self.store.lender_positions[key] = position
        return position

    def find_pool_transaction_by_idempotency(
        self, wallet_address: str, key: str
    ) -> DemoPoolTransaction | None:
        return self.store.pool_transactions.get((wallet_address.lower(), key))

    def save_pool_transaction(
        self, wallet_address: str, transaction: DemoPoolTransaction
    ) -> DemoPoolTransaction:
        self.store.pool_transactions[(wallet_address.lower(), transaction.idempotency_key)] = transaction
        return transaction

    def update_pool_transaction(self, transaction: DemoPoolTransaction) -> DemoPoolTransaction:
        self.store.pool_transactions[(transaction.wallet_address, transaction.idempotency_key)] = transaction
        return transaction

    def get_user_for_token(self, token: str) -> str | None:
        return self.store.wallet_by_token.get(token)

    def get_user_role(self, wallet_address: str) -> str | None:
        user = self.store.users_by_wallet.get(wallet_address.lower())
        return user.role if user is not None else None

    def get_profile(self, wallet_address: str) -> DemoBorrowerProfile | None:
        return self.store.profiles_by_wallet.get(wallet_address)

    def create_profile(self, profile: DemoBorrowerProfile) -> DemoBorrowerProfile:
        self.store.profiles_by_wallet[profile.wallet_address] = profile
        return profile

    def update_profile_identity(
        self, wallet_address: str, transaction_hash: str
    ) -> DemoBorrowerProfile | None:
        profile = self.store.profiles_by_wallet.get(wallet_address)
        if profile is not None:
            profile.identity_status = "registered"
            profile.registration_transaction_hash = transaction_hash
        return profile

    def list_evidence(self, wallet_address: str) -> list[DemoEvidence]:
        return self.store.evidence_by_wallet.get(wallet_address, [])

    def save_evidence(self, wallet_address: str, evidence: DemoEvidence) -> DemoEvidence:
        self.store.evidence_by_wallet.setdefault(wallet_address, []).append(evidence)
        return evidence

    def current_assessment(self, wallet_address: str) -> DemoAssessment | None:
        assessments = self.store.assessments_by_wallet.get(wallet_address, [])
        return assessments[-1] if assessments else None

    def list_assessments(self, wallet_address: str) -> list[DemoAssessment]:
        return list(reversed(self.store.assessments_by_wallet.get(wallet_address, [])))

    def save_assessment(self, wallet_address: str, assessment: DemoAssessment) -> DemoAssessment:
        self.store.assessments_by_wallet.setdefault(wallet_address, []).append(assessment)
        return assessment

    def list_loans(self, wallet_address: str) -> list[DemoLoan]:
        return list(reversed(self.store.loans_by_wallet.get(wallet_address, [])))

    def list_open_loans(self) -> list[DemoLoan]:
        return [
            loan
            for loans in self.store.loans_by_wallet.values()
            for loan in loans
            if loan.status == "requested"
        ]

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

    def get_loan(self, wallet_address: str, loan_id: UUID) -> DemoLoan | None:
        return next(
            (loan for loan in self.store.loans_by_wallet.get(wallet_address, []) if loan.id == loan_id),
            None,
        )

    def find_repayment_by_idempotency(self, wallet_address: str, key: str) -> DemoRepayment | None:
        return next(
            (
                repayment
                for repayments in self.store.repayments_by_loan.values()
                for repayment in repayments
                if repayment.wallet_address == wallet_address
                and repayment.idempotency_key == key
            ),
            None,
        )

    def find_repayment(self, wallet_address: str, repayment_id: UUID) -> DemoRepayment | None:
        return next(
            (
                repayment
                for repayments in self.store.repayments_by_loan.values()
                for repayment in repayments
                if repayment.wallet_address == wallet_address and repayment.id == repayment_id
            ),
            None,
        )

    def list_repayments(self, wallet_address: str, loan_id: UUID) -> list[DemoRepayment]:
        return [
            repayment
            for repayment in self.store.repayments_by_loan.get(loan_id, [])
            if repayment.wallet_address == wallet_address
        ]

    def save_repayment(self, wallet_address: str, repayment: DemoRepayment) -> DemoRepayment:
        self.store.repayments_by_loan.setdefault(repayment.loan_id, []).append(repayment)
        return repayment

    def update_repayment(self, repayment: DemoRepayment) -> DemoRepayment:
        return repayment

    def list_recovery_requests(self, wallet_address: str) -> list[DemoRecoveryRequest]:
        return [
            item for item in self.store.recovery_requests.values()
            if item.wallet_address == wallet_address
        ]

    def get_recovery_request(
        self, wallet_address: str, recovery_id: UUID
    ) -> DemoRecoveryRequest | None:
        item = self.store.recovery_requests.get(recovery_id)
        return item if item and item.wallet_address == wallet_address else None

    def save_recovery_request(
        self, wallet_address: str, recovery: DemoRecoveryRequest
    ) -> DemoRecoveryRequest:
        self.store.recovery_requests[recovery.id] = recovery
        return recovery

    def save_recovery_milestone(self, milestone: dict[str, object]) -> dict[str, object]:
        return milestone

    def find_recovery_by_milestone(
        self, wallet_address: str, milestone_id: UUID
    ) -> DemoRecoveryRequest | None:
        return next(
            (
                item for item in self.store.recovery_requests.values()
                if item.wallet_address == wallet_address
                and any(milestone["id"] == milestone_id for milestone in item.milestones)
            ),
            None,
        )

    def save_dispute(self, wallet_address: str, dispute: DemoDispute) -> DemoDispute:
        self.store.disputes[dispute.id] = dispute
        return dispute

    def list_disputes(
        self, wallet_address: str | None = None, open_only: bool = False
    ) -> list[DemoDispute]:
        return [
            item for item in self.store.disputes.values()
            if (wallet_address is None or item.wallet_address == wallet_address)
            and (not open_only or item.status == "open")
        ]

    def get_dispute(self, dispute_id: UUID) -> DemoDispute | None:
        return self.store.disputes.get(dispute_id)

    def save_audit_record(self, audit: AuditRecord) -> AuditRecord:
        return audit


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
