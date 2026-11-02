from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status

from app.config import get_settings
from app.schemas.auth import AuthenticatedUser
from app.schemas.borrower import BorrowerProfileResponse, BorrowerRegistrationRequest
from app.schemas.chain import TransactionSyncRequest
from app.repositories import demo_store
from app.repositories.demo import DemoBorrowerProfile
from app.services.chain_service import chain_service


class BorrowerService:
    def register(
        self,
        user: AuthenticatedUser,
        request: BorrowerRegistrationRequest,
    ) -> BorrowerProfileResponse:
        existing = demo_store.profiles_by_wallet.get(user.wallet_address)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A borrower profile already exists for this wallet.",
            )

        profile = DemoBorrowerProfile(
            id=uuid4(),
            user_id=demo_store.users_by_wallet[user.wallet_address].id,
            wallet_address=user.wallet_address,
            display_name=request.display_name.strip(),
            bio=request.bio.strip() if request.bio else None,
            identity_status="pending",
            registration_transaction_hash=None,
            created_at=datetime.now(UTC),
        )
        demo_store.profiles_by_wallet[user.wallet_address] = profile
        return self._to_response(profile)

    def get_profile(self, user: AuthenticatedUser) -> BorrowerProfileResponse:
        profile = demo_store.profiles_by_wallet.get(user.wallet_address)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Borrower profile has not been registered.",
            )
        return self._to_response(profile)

    async def sync_identity(
        self, user: AuthenticatedUser, request: TransactionSyncRequest
    ) -> BorrowerProfileResponse:
        """Mark the identity registered only after an IdentityRegistered receipt is verified.

        Idempotent for the same transaction hash; a different hash for an already
        registered identity is a conflict.
        """
        profile = demo_store.profiles_by_wallet.get(user.wallet_address)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Borrower profile has not been registered.",
            )

        transaction_hash = request.transaction_hash.lower()
        if profile.identity_status == "registered":
            if profile.registration_transaction_hash == transaction_hash:
                return self._to_response(profile)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Identity is already linked to a different registration transaction.",
            )

        await chain_service.verify_event(
            transaction_hash,
            get_settings().identity_registry_address,
            "IdentityRegistry.IdentityRegistered",
            user.wallet_address,
        )
        profile.identity_status = "registered"
        profile.registration_transaction_hash = transaction_hash
        return self._to_response(profile)

    @staticmethod
    def _to_response(profile: DemoBorrowerProfile) -> BorrowerProfileResponse:
        return BorrowerProfileResponse(
            id=profile.id,
            wallet_address=profile.wallet_address,
            display_name=profile.display_name,
            bio=profile.bio,
            identity_status=profile.identity_status,  # type: ignore[arg-type]
            registration_transaction_hash=profile.registration_transaction_hash,
            created_at=profile.created_at,
        )


borrower_service = BorrowerService()
