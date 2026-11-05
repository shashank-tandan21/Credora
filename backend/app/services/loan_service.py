from datetime import UTC, date, datetime, timedelta
import json
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
from app.config import get_settings
from app.models import Loan
from app.repositories import demo_store, get_repository
from app.repositories.demo import DemoAssessment, DemoLoan
from app.services.repository_support import repository_call


ANNUAL_INTEREST_RATE = 0.12
MAX_SCORE_LIMIT = 2_000.0


class LoanService:
    async def quote(self, user: AuthenticatedUser, request: LoanQuoteRequest) -> LoanQuoteResponse:
        eligible_limit = await self._eligible_limit(user)
        if request.amount > eligible_limit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Requested amount exceeds the eligible limit of ₹{eligible_limit:.2f}.",
            )
        if get_settings().demo_mode and request.amount > demo_store.pool_liquidity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Requested amount exceeds available pool liquidity.",
            )
        return self._quote_response(request.amount, request.duration_days, eligible_limit)

    async def request_loan(
        self, user: AuthenticatedUser, request: LoanQuoteRequest
    ) -> LoanRequestResponse:
        quote = await self.quote(user, request)
        now = datetime.now(UTC)
        installments = [item.model_dump(mode="json") for item in quote.installments]
        if get_settings().demo_mode:
            loan = DemoLoan(
                id=uuid4(),
                wallet_address=user.wallet_address,
                principal_amount=quote.amount,
                interest_rate=quote.interest_rate,
                interest_amount=quote.interest_amount,
                total_repayment=quote.total_repayment,
                duration_days=quote.duration_days,
                installments=installments,
                status="requested",
                created_at=now,
            )
        else:
            loan = Loan(
                principal_amount=quote.amount,
                interest_rate=quote.interest_rate,
                interest_amount=quote.interest_amount,
                total_repayment=quote.total_repayment,
                duration_days=quote.duration_days,
                installments=json.dumps(installments),
                status="requested",
            )
        loan = await repository_call(get_repository().save_loan, user.wallet_address, loan)
        if get_settings().demo_mode:
            demo_store.pool_liquidity = round(demo_store.pool_liquidity - quote.amount, 2)
        return self._loan_response(loan, quote.eligible_limit, user.wallet_address)

    async def list_loans(self, user: AuthenticatedUser) -> list[LoanRequestResponse]:
        loans = await repository_call(get_repository().list_loans, user.wallet_address)
        return [
            self._loan_response(loan, await self._eligible_limit(user), user.wallet_address)
            for loan in loans
        ]

    async def list_open_loans(self) -> list[LoanRequestResponse]:
        loans = await repository_call(get_repository().list_open_loans)
        return [self._loan_response(loan, 0, loan.wallet_address) for loan in loans]

    async def pool_statistics(self) -> PoolStatisticsResponse:
        if not get_settings().demo_mode:
            result = await repository_call(get_repository().pool_statistics)
            return PoolStatisticsResponse.model_validate(result)
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
    async def _eligible_limit(user: AuthenticatedUser) -> float:
        current = await repository_call(get_repository().current_assessment, user.wallet_address)
        if current is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Create a current credit assessment before requesting a loan.",
            )
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
    def _loan_response(
        loan: DemoLoan | Loan, eligible_limit: float, wallet_address: str
    ) -> LoanRequestResponse:
        if isinstance(loan, Loan):
            installments = json.loads(loan.installments)
        else:
            installments = loan.installments
        return LoanRequestResponse(
            id=loan.id,
            wallet_address=getattr(loan, "wallet_address", wallet_address),
            amount=loan.principal_amount,
            eligible_limit=eligible_limit,
            interest_rate=loan.interest_rate,
            interest_amount=loan.interest_amount,
            total_repayment=loan.total_repayment,
            duration_days=loan.duration_days,
            installments=[RepaymentInstallment.model_validate(item) for item in installments],
            status=loan.status,  # type: ignore[arg-type]
            created_at=loan.created_at,
        )


loan_service = LoanService()
