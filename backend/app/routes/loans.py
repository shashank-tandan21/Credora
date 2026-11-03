from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser
from app.schemas.loan import LoanQuoteRequest, LoanQuoteResponse, LoanRequestResponse
from app.services.loan_service import loan_service


router = APIRouter(prefix="/loans")


@router.post("/quote", response_model=LoanQuoteResponse)
async def quote_loan(
    request: LoanQuoteRequest, current_user: CurrentUser
) -> LoanQuoteResponse:
    return await loan_service.quote(current_user, request)


@router.post("", response_model=LoanRequestResponse, status_code=status.HTTP_201_CREATED)
async def request_loan(
    request: LoanQuoteRequest, current_user: CurrentUser
) -> LoanRequestResponse:
    return await loan_service.request_loan(current_user, request)


@router.get("", response_model=list[LoanRequestResponse])
async def list_my_loans(current_user: CurrentUser) -> list[LoanRequestResponse]:
    return await loan_service.list_loans(current_user)
