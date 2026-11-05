from fastapi import APIRouter

from app.schemas.loan import LoanRequestResponse, PoolStatisticsResponse
from app.services.loan_service import loan_service


router = APIRouter(prefix="/pool")


@router.get("/statistics", response_model=PoolStatisticsResponse)
async def get_pool_statistics() -> PoolStatisticsResponse:
    return await loan_service.pool_statistics()


@router.get("/loan-requests", response_model=list[LoanRequestResponse])
async def list_pool_loan_requests() -> list[LoanRequestResponse]:
    return await loan_service.list_open_loans()
