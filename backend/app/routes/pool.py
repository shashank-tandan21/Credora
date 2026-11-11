from uuid import UUID

from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.schemas.loan import LoanRequestResponse, PoolStatisticsResponse
from app.services.loan_service import loan_service


router = APIRouter(prefix="/pool")


@router.get("/statistics", response_model=PoolStatisticsResponse)
async def get_pool_statistics() -> PoolStatisticsResponse:
    return await loan_service.pool_statistics()


@router.get("/loan-requests", response_model=list[LoanRequestResponse])
async def list_pool_loan_requests() -> list[LoanRequestResponse]:
    return await loan_service.list_open_loans()


@router.post("/loan-requests/{loan_id}/fund", response_model=LoanRequestResponse)
async def fund_pool_loan_request(loan_id: UUID, current_user: CurrentUser) -> LoanRequestResponse:
    return await loan_service.fund_demo_loan(loan_id, current_user)
