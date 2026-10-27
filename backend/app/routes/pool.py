from fastapi import APIRouter

from app.schemas.loan import PoolStatisticsResponse
from app.services.loan_service import loan_service


router = APIRouter(prefix="/pool")


@router.get("/statistics", response_model=PoolStatisticsResponse)
async def get_pool_statistics() -> PoolStatisticsResponse:
    return loan_service.pool_statistics()
