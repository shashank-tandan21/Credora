from uuid import UUID

from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.schemas.workflow import (
    LenderPositionResponse,
    PoolTransactionRequest,
    PoolTransactionResponse,
    RepaymentSyncRequest,
)
from app.services.lender_service import lender_service


router = APIRouter(prefix="/pool")


@router.get("/me", response_model=LenderPositionResponse)
async def get_lender_position(user: CurrentUser) -> LenderPositionResponse:
    return await lender_service.get_position(user)


@router.post("/deposit", response_model=PoolTransactionResponse)
async def prepare_deposit(
    request: PoolTransactionRequest, user: CurrentUser
) -> PoolTransactionResponse:
    return await lender_service.prepare(user, "deposit", request)


@router.post("/withdraw", response_model=PoolTransactionResponse)
async def prepare_withdrawal(
    request: PoolTransactionRequest, user: CurrentUser
) -> PoolTransactionResponse:
    return await lender_service.prepare(user, "withdrawal", request)


@router.post("/transactions/{transaction_id}/sync", response_model=PoolTransactionResponse)
async def sync_pool_transaction(
    transaction_id: UUID, request: RepaymentSyncRequest, user: CurrentUser
) -> PoolTransactionResponse:
    return await lender_service.sync(
        user, transaction_id, request.status, request.transaction_hash
    )
