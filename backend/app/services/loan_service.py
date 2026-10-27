from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status

from app.schemas.auth import AuthenticatedUser
from app.schemas.loan import (
    LoanQuoteRequest,
    LoanQuoteResponse,
    LoanRequestResponse,
    PoolStatisticsResponse,
    RepaymentInstallment,
)
from app.services.demo_store import DemoAssessment, DemoLoan, demo_store


ANNUAL_INTEREST_RATE = 0.12
MAX_SCORE_LIMIT = 2_000.0


class LoanService:
    def quote(self, user: AuthenticatedUser, request: LoanQuoteRequest) -> LoanQuoteResponse:
        eligible_limit = self._eligible_limit(user)
        if request.amount > eligible_limit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Requested amount exceeds the eligible limit of {eligible_limit:.2f} MockUSDC.",
            )
        if request.amount > demo_store.pool_liquidity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Requested amount exceeds available pool liquidity.",
            )
        return self._quote_response(request.amount, request.duration_days, eligible_limit)

    def request_loan(
        self, user: AuthenticatedUser, request: LoanQuoteRequest
    ) -> LoanRequestResponse:
        quote = self.quote(user, request)
        now = datetime.now(UTC)
        loan = DemoLoan(
            id=uuid4(),
            wallet_address=user.wallet_address,
            principal_amount=quote.amount,
            interest_rate=quote.interest_rate,
            interest_amount=quote.interest_amount,
            total_repayment=quote.total_repayment,
            duration_days=quote.duration_days,
            installments=[item.model_dump(mode="json") for item in quote.installments],
            status="requested",
            created_at=now,
        )
        demo_store.loans_by_wallet.setdefault(user.wallet_address, []).append(loan)
        demo_store.pool_liquidity = round(demo_store.pool_liquidity - quote.amount, 2)
        return self._loan_response(loan, quote.eligible_limit)

    def list_loans(self, user: AuthenticatedUser) -> list[LoanRequestResponse]:
        return [
            self._loan_response(loan, self._eligible_limit(user))
            for loan in reversed(demo_store.loans_by_wallet.get(user.wallet_address, []))
        ]

    def pool_statistics(self) -> PoolStatisticsResponse:
        loans = [loan for items in demo_store.loans_by_wallet.values() for loan in items]
        outstanding = sum(loan.principal_amount for loan in loans)
        total_deposited = demo_store.pool_total_deposited
        return PoolStatisticsResponse(
            total_pool_liquidity=round(demo_store.pool_liquidity, 2),
            total_deposited=round(total_deposited, 2),
            total_active_loans=len(loans),
            total_outstanding_principal=round(outstanding, 2),
            utilization_rate=round(outstanding / total_deposited * 100, 2)
            if total_deposited
            else 0,
        )

    @staticmethod
    def _eligible_limit(user: AuthenticatedUser) -> float:
        assessments = demo_store.assessments_by_wallet.get(user.wallet_address, [])
        if not assessments:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Create a current credit assessment before requesting a loan.",
            )
        current: DemoAssessment = assessments[-1]
        if current.expires_at <= datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="The current credit assessment has expired.",
            )
        return round(min(current.score * 15, MAX_SCORE_LIMIT), 2)

    @staticmethod
    def _quote_response(amount: float, duration_days: int, eligible_limit: float) -> LoanQuoteResponse:
        interest_amount = round(amount * ANNUAL_INTEREST_RATE * duration_days / 365, 2)
        total_repayment = round(amount + interest_amount, 2)
        installment_count = max(1, (duration_days + 29) // 30)
        installment_amount = round(total_repayment / installment_count, 2)
        installments = []
        remaining = total_repayment
        for number in range(1, installment_count + 1):
            amount_due = installment_amount if number < installment_count else round(remaining, 2)
            remaining -= amount_due
            installments.append(
                RepaymentInstallment(
                    installment_number=number,
                    due_date=date.today() + timedelta(days=30 * number),
                    amount=amount_due,
                )
            )
        return LoanQuoteResponse(
            amount=amount,
            eligible_limit=eligible_limit,
            interest_rate=ANNUAL_INTEREST_RATE * 100,
            interest_amount=interest_amount,
            total_repayment=total_repayment,
            duration_days=duration_days,
            installments=installments,
        )

    @staticmethod
    def _loan_response(loan: DemoLoan, eligible_limit: float) -> LoanRequestResponse:
        return LoanRequestResponse(
            id=loan.id,
            wallet_address=loan.wallet_address,
            amount=loan.principal_amount,
            eligible_limit=eligible_limit,
            interest_rate=loan.interest_rate,
            interest_amount=loan.interest_amount,
            total_repayment=loan.total_repayment,
            duration_days=loan.duration_days,
            installments=[RepaymentInstallment.model_validate(item) for item in loan.installments],
            status=loan.status,  # type: ignore[arg-type]
            created_at=loan.created_at,
        )


loan_service = LoanService()
