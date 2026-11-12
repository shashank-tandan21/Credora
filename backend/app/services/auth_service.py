import secrets
from datetime import UTC, datetime, timedelta

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import HTTPException, status

from app.config import get_settings
from app.schemas.auth import (
    AuthenticatedUser,
    NonceResponse,
    VerifySignatureRequest,
    VerifySignatureResponse,
)
from app.repositories import get_repository
from app.services.repository_support import repository_call


class AuthService:
    def __init__(self) -> None:
        self._nonces: dict[str, tuple[str, datetime, str]] = {}

    def create_nonce(self, wallet_address: str) -> NonceResponse:
        settings = get_settings()
        nonce = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(seconds=settings.auth_nonce_expiry_seconds)
        normalized_address = wallet_address.lower()
        issued_at = datetime.now(UTC)
        settings = get_settings()
        message = (
            f"{settings.auth_domain} wants you to sign in with your Ethereum account:\n"
            f"{normalized_address}\n\n"
            "Sign in to REBOUND.\n\n"
            f"URI: {settings.auth_uri}\n"
            "Version: 1\n"
            f"Chain ID: {settings.chain_id}\n"
            f"Nonce: {nonce}\n"
            f"Issued At: {issued_at.isoformat()}\n"
            f"Expiration Time: {expires_at.isoformat()}"
        )
        self._nonces[normalized_address] = (nonce, expires_at, message)
        return NonceResponse(
            wallet_address=normalized_address,
            nonce=nonce,
            message=message,
            expires_at=expires_at,
        )

    async def verify_signature(self, request: VerifySignatureRequest) -> VerifySignatureResponse:
        settings = get_settings()
        normalized_address = request.wallet_address.lower()
        stored = self._nonces.get(normalized_address)
        now = datetime.now(UTC)

        if stored is None or stored[0] != request.nonce or stored[1] <= now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nonce is missing, mismatched, or expired.",
            )

        # Demo Mode also accepts a real wallet signature, verified below, so an
        # on-chain frontend can sign in against the in-memory demo backend.
        if settings.demo_mode and request.signature.startswith("demo:"):
            if request.signature != f"demo:{request.nonce}":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Demo signature is invalid.",
                )
        else:
            if request.message != stored[2]:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication message is invalid or expired.",
                )
            try:
                recovered = Account.recover_message(
                    encode_defunct(text=stored[2]), signature=request.signature
                )
            except (TypeError, ValueError):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Ethereum signature is invalid.",
                ) from None
            if recovered.lower() != normalized_address:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Ethereum signature does not match the wallet.",
                )

        del self._nonces[normalized_address]
        user_record = await repository_call(
            get_repository().get_or_create_user, normalized_address
        )
        user = AuthenticatedUser(
            wallet_address=normalized_address,
            role=user_record.role,
            demo_mode=settings.demo_mode,
        )
        token = f"session-token:{secrets.token_urlsafe(24)}"
        await repository_call(get_repository().create_token, normalized_address, token)
        return VerifySignatureResponse(
            access_token=token,
            user=user,
        )

    async def get_user_for_token(self, token: str) -> AuthenticatedUser | None:
        wallet_address = await repository_call(get_repository().get_user_for_token, token)
        if wallet_address is None:
            return None
        role = await repository_call(get_repository().get_user_role, wallet_address)
        if role is None:
            return None
        return AuthenticatedUser(
            wallet_address=wallet_address,
            role=role,
            demo_mode=get_settings().demo_mode,
        )


auth_service = AuthService()
