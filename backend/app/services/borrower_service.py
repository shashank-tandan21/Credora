from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status

from app.config import get_settings
from app.models import BorrowerProfile
from app.repositories import get_repository
from app.schemas.auth import AuthenticatedUser
from app.schemas.borrower import BorrowerProfileResponse, BorrowerRegistrationRequest
from app.schemas.chain import TransactionSyncRequest
from app.repositories import demo_store
from app.repositories.demo import DemoBorrowerProfile
from app.services.chain_service import chain_service
from app.services.repository_support import repository_call


class BorrowerService:
    async def register(
        self,
        user: AuthenticatedUser,
        request: BorrowerRegistrationRequest,
    ) -> BorrowerProfileResponse:
        existing = await repository_call(get_repository().get_profile, user.wallet_address)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A borrower profile already exists for this wallet.",
            )

        if get_settings().demo_mode:
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
        else:
            profile = BorrowerProfile(
                user_id=(await repository_call(
                    get_repository().get_or_create_user, user.wallet_address
                )).id,
                display_name=request.display_name.strip(),
                bio=request.bio.strip() if request.bio else None,
                identity_status="pending",
            )
        profile = await repository_call(get_repository().create_profile, profile)
        return self._to_response(profile, user.wallet_address)

    async def get_profile(self, user: AuthenticatedUser) -> BorrowerProfileResponse:
        profile = await repository_call(get_repository().get_profile, user.wallet_address)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Borrower profile has not been registered.",
            )
        return self._to_response(profile, user.wallet_address)

    async def sync_identity(
        self, user: AuthenticatedUser, request: TransactionSyncRequest
    ) -> BorrowerProfileResponse:
        """Mark the identity registered only after an IdentityRegistered receipt is verified.

        Idempotent for the same transaction hash; a different hash for an already
        registered identity is a conflict.
        """
        profile = await repository_call(get_repository().get_profile, user.wallet_address)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Borrower profile has not been registered.",
            )

        transaction_hash = request.transaction_hash.lower()
        if profile.identity_status == "registered":
            if profile.registration_transaction_hash == transaction_hash:
                return self._to_response(profile, user.wallet_address)
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
        profile = await repository_call(
            get_repository().update_profile_identity,
            user.wallet_address,
            transaction_hash,
        )
        if profile is None:
            raise HTTPException(status_code=404, detail="Borrower profile has not been registered.")
        return self._to_response(profile, user.wallet_address)

    @staticmethod
    def _to_response(profile: DemoBorrowerProfile | BorrowerProfile, wallet_address: str) -> BorrowerProfileResponse:
        return BorrowerProfileResponse(
            id=profile.id,
            wallet_address=getattr(profile, "wallet_address", wallet_address),
            display_name=profile.display_name,
            bio=profile.bio,
            identity_status=profile.identity_status,  # type: ignore[arg-type]
            registration_transaction_hash=profile.registration_transaction_hash,
            created_at=profile.created_at,
        )


borrower_service = BorrowerService()
