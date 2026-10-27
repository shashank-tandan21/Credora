from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4


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


class DemoStore:
    def __init__(self) -> None:
        self.users_by_wallet: dict[str, DemoUser] = {}
        self.profiles_by_wallet: dict[str, DemoBorrowerProfile] = {}
        self.wallet_by_token: dict[str, str] = {}
        self.evidence_by_wallet: dict[str, list[DemoEvidence]] = {}
        self.assessments_by_wallet: dict[str, list[DemoAssessment]] = {}
        self.loans_by_wallet: dict[str, list[DemoLoan]] = {}
        self.pool_liquidity: float = 25_000.0
        self.pool_total_deposited: float = 30_000.0

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


demo_store = DemoStore()
