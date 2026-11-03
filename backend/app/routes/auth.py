from fastapi import APIRouter

from app.schemas.auth import (
    NonceRequest,
    NonceResponse,
    VerifySignatureRequest,
    VerifySignatureResponse,
)
from app.services.auth_service import auth_service


router = APIRouter()


@router.post("/nonce", response_model=NonceResponse)
async def create_auth_nonce(request: NonceRequest) -> NonceResponse:
    return auth_service.create_nonce(request.wallet_address)


@router.post("/verify", response_model=VerifySignatureResponse)
async def verify_wallet_signature(
    request: VerifySignatureRequest,
) -> VerifySignatureResponse:
    return await auth_service.verify_signature(request)
