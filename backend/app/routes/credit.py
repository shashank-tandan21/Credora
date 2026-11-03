from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser
from app.schemas.credit import (
    CreditAssessmentRequest,
    CreditAssessmentResponse,
    EvidenceResponse,
    EvidenceSubmissionRequest,
)
from app.services.credit_service import credit_service


router = APIRouter(prefix="/credit")


@router.post("/evidence", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def submit_evidence(
    request: EvidenceSubmissionRequest, current_user: CurrentUser
) -> EvidenceResponse:
    return await credit_service.add_evidence(current_user, request)


@router.get("/evidence", response_model=list[EvidenceResponse])
async def list_evidence(current_user: CurrentUser) -> list[EvidenceResponse]:
    return await credit_service.list_evidence(current_user)


@router.post("/assess", response_model=CreditAssessmentResponse)
async def create_assessment(
    request: CreditAssessmentRequest, current_user: CurrentUser
) -> CreditAssessmentResponse:
    return await credit_service.assess(current_user, request)


@router.get("/current", response_model=CreditAssessmentResponse)
async def get_current_assessment(current_user: CurrentUser) -> CreditAssessmentResponse:
    return await credit_service.current(current_user)


@router.get("/history", response_model=list[CreditAssessmentResponse])
async def get_assessment_history(current_user: CurrentUser) -> list[CreditAssessmentResponse]:
    return await credit_service.history(current_user)
