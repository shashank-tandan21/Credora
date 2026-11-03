from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser
from app.schemas.workflow import (
    DisputeCreate,
    DisputeResolve,
    DisputeResponse,
    RecoveryMilestoneCreate,
    RecoveryProgressResponse,
    RecoveryRequestCreate,
    RecoveryRequestResponse,
    RepaymentPrepareRequest,
    RepaymentQuoteRequest,
    RepaymentResponse,
    RepaymentSyncRequest,
)
from app.services.workflow_service import workflow_service


repayment_router = APIRouter(prefix="/loans/{loan_id}/repayments")


@repayment_router.post("/quote", response_model=RepaymentResponse)
async def quote_repayment(
    loan_id: UUID, request: RepaymentQuoteRequest, current_user: CurrentUser
) -> RepaymentResponse:
    return await workflow_service.quote_repayment(current_user, loan_id, request)


@repayment_router.post("/prepare", response_model=RepaymentResponse)
async def prepare_repayment(
    loan_id: UUID, request: RepaymentPrepareRequest, current_user: CurrentUser
) -> RepaymentResponse:
    return await workflow_service.prepare_repayment(current_user, loan_id, request)


@repayment_router.get("", response_model=list[RepaymentResponse])
async def list_repayments(loan_id: UUID, current_user: CurrentUser) -> list[RepaymentResponse]:
    return await workflow_service.list_repayments(current_user, loan_id)


repayment_sync_router = APIRouter(prefix="/repayments")


@repayment_sync_router.post("/{repayment_id}/sync", response_model=RepaymentResponse)
async def sync_repayment(
    repayment_id: UUID, request: RepaymentSyncRequest, current_user: CurrentUser
) -> RepaymentResponse:
    return await workflow_service.sync_repayment(current_user, repayment_id, request)


recovery_router = APIRouter(prefix="/recovery")


@recovery_router.post(
    "/requests", response_model=RecoveryRequestResponse, status_code=status.HTTP_201_CREATED
)
async def create_recovery(
    request: RecoveryRequestCreate, current_user: CurrentUser
) -> RecoveryRequestResponse:
    return await workflow_service.create_recovery(current_user, request)


@recovery_router.get("/requests", response_model=list[RecoveryRequestResponse])
async def list_recovery(current_user: CurrentUser) -> list[RecoveryRequestResponse]:
    return await workflow_service.list_recovery(current_user)


@recovery_router.get("/overdue", response_model=list[UUID])
async def list_overdue(current_user: CurrentUser) -> list[UUID]:
    return await workflow_service.overdue_loans(current_user)


@recovery_router.post(
    "/requests/{recovery_id}/milestones", response_model=RecoveryRequestResponse
)
async def add_milestone(
    recovery_id: UUID, request: RecoveryMilestoneCreate, current_user: CurrentUser
) -> RecoveryRequestResponse:
    return await workflow_service.add_milestone(current_user, recovery_id, request)


@recovery_router.post(
    "/milestones/{milestone_id}/complete", response_model=RecoveryRequestResponse
)
async def complete_milestone(
    milestone_id: UUID, current_user: CurrentUser
) -> RecoveryRequestResponse:
    return await workflow_service.complete_milestone(current_user, milestone_id)


@recovery_router.get(
    "/requests/{recovery_id}/progress", response_model=RecoveryProgressResponse
)
async def recovery_progress(
    recovery_id: UUID, current_user: CurrentUser
) -> RecoveryProgressResponse:
    return await workflow_service.recovery_progress(current_user, recovery_id)


dispute_router = APIRouter(prefix="/disputes")


@dispute_router.post("", response_model=DisputeResponse, status_code=status.HTTP_201_CREATED)
async def create_dispute(
    request: DisputeCreate, current_user: CurrentUser
) -> DisputeResponse:
    return await workflow_service.create_dispute(current_user, request)


@dispute_router.get("", response_model=list[DisputeResponse])
async def list_disputes(current_user: CurrentUser) -> list[DisputeResponse]:
    return await workflow_service.list_disputes(current_user)


reviewer_router = APIRouter(prefix="/reviewer/disputes")


@reviewer_router.get("", response_model=list[DisputeResponse])
async def reviewer_queue(current_user: CurrentUser) -> list[DisputeResponse]:
    return await workflow_service.reviewer_queue(current_user)


@reviewer_router.post("/{dispute_id}/resolve", response_model=DisputeResponse)
async def resolve_dispute(
    dispute_id: UUID, request: DisputeResolve, current_user: CurrentUser
) -> DisputeResponse:
    return await workflow_service.resolve_dispute(current_user, dispute_id, request)
