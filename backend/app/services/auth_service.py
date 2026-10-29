import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status

from app.config import get_settings
from app.schemas.auth import (
    AuthenticatedUser,
    NonceResponse,
    VerifySignatureRequest,
    VerifySignatureResponse,
)
from app.repositories import demo_store


class AuthService:
    def __init__(self) -> None:
        self._nonces: dict[str, tuple[str, datetime]] = {}

    def create_nonce(self, wallet_address: str) -> NonceResponse:
        settings = get_settings()
        nonce = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(seconds=settings.auth_nonce_expiry_seconds)
        normalized_address = wallet_address.lower()
        self._nonces[normalized_address] = (nonce, expires_at)
        message = (
            "REBOUND wallet authentication\n"
            f"Wallet: {normalized_address}\n"
            f"Nonce: {nonce}\n"
            f"Expires: {expires_at.isoformat()}"
        )
        return NonceResponse(
            wallet_address=normalized_address,
            nonce=nonce,
            message=message,
            expires_at=expires_at,
        )

    def verify_signature(self, request: VerifySignatureRequest) -> VerifySignatureResponse:
        settings = get_settings()
        normalized_address = request.wallet_address.lower()
        stored = self._nonces.get(normalized_address)
        now = datetime.now(UTC)

        if stored is None or stored[0] != request.nonce or stored[1] <= now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nonce is missing, mismatched, or expired.",
            )

        if not settings.demo_mode:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Ethereum signature verification is not configured.",
            )

        if request.signature != f"demo:{request.nonce}":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Demo signature is invalid.",
            )

        del self._nonces[normalized_address]
        demo_store.get_or_create_user(normalized_address)
        user = AuthenticatedUser(
            wallet_address=normalized_address,
            role="borrower",
            demo_mode=True,
        )
        token = f"demo-token:{secrets.token_urlsafe(24)}"
        demo_store.create_token(normalized_address, token)
        return VerifySignatureResponse(
            access_token=token,
            user=user,
        )

    def get_user_for_token(self, token: str) -> AuthenticatedUser | None:
        wallet_address = demo_store.wallet_by_token.get(token)
        if wallet_address is None:
            return None
        user = demo_store.users_by_wallet.get(wallet_address)
        if user is None:
            return None
        return AuthenticatedUser(
            wallet_address=user.wallet_address,
            role="borrower",
            demo_mode=True,
        )


auth_service = AuthService()
