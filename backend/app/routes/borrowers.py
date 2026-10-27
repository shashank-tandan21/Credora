from fastapi import APIRouter, status

from app.api.dependencies import CurrentUser
from app.schemas.borrower import BorrowerProfileResponse, BorrowerRegistrationRequest
from app.services.borrower_service import borrower_service


router = APIRouter(prefix="/borrowers")


@router.post(
    "/register",
    response_model=BorrowerProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_borrower(
    request: BorrowerRegistrationRequest,
    current_user: CurrentUser,
) -> BorrowerProfileResponse:
    return borrower_service.register(current_user, request)


@router.get("/me", response_model=BorrowerProfileResponse)
async def get_my_borrower_profile(current_user: CurrentUser) -> BorrowerProfileResponse:
    return borrower_service.get_profile(current_user)
