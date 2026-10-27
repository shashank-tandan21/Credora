from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status

from app.schemas.auth import AuthenticatedUser
from app.schemas.borrower import BorrowerProfileResponse, BorrowerRegistrationRequest
from app.services.demo_store import DemoBorrowerProfile, demo_store


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
