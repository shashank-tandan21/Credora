from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException

from app.models.workflow import PoolTransaction, PoolTransactionType, TransactionStatus
from app.repositories import get_repository
from app.schemas.auth import AuthenticatedUser
from app.schemas.workflow import (
    LenderPositionResponse,
    PoolTransactionRequest,
    PoolTransactionResponse,
)
from app.services.repository_support import repository_call


class LenderService:
    async def get_position(self, user: AuthenticatedUser) -> LenderPositionResponse:
        position = await repository_call(get_repository().get_lender_position, user.wallet_address)
        return LenderPositionResponse(
            deposited_amount=float(position.deposited_amount),
            withdrawn_amount=float(position.withdrawn_amount),
            pool_share=float(position.pool_share),
            current_value=float(position.deposited_amount) - float(position.withdrawn_amount),
        )

    async def prepare(
        self,
        user: AuthenticatedUser,
        transaction_type: str,
        request: PoolTransactionRequest,
    ) -> PoolTransactionResponse:
        repository = get_repository()
        existing = await repository_call(
            repository.find_pool_transaction_by_idempotency,
            user.wallet_address,
            request.idempotency_key,
        )
        if existing is not None:
            if existing.transaction_type != transaction_type or float(existing.amount) != request.amount:
                raise HTTPException(status_code=409, detail="Idempotency key was reused with different values.")
            return self._response(existing)

        if transaction_type == PoolTransactionType.WITHDRAWAL.value:
            position = await repository_call(repository.get_lender_position, user.wallet_address)
            available = float(position.deposited_amount) - float(position.withdrawn_amount)
            if request.amount > available:
                raise HTTPException(status_code=409, detail="Withdrawal exceeds the available lender position.")

        if hasattr(repository, "store"):
            from app.repositories.demo import DemoPoolTransaction

            transaction = DemoPoolTransaction(
                id=uuid4(),
                wallet_address=user.wallet_address.lower(),
                transaction_type=transaction_type,
                amount=request.amount,
                status=TransactionStatus.PREPARED.value,
                transaction_hash=None,
                idempotency_key=request.idempotency_key,
            )
        else:
            transaction = PoolTransaction(
                transaction_type=transaction_type,
                amount=Decimal(str(request.amount)),
                status=TransactionStatus.PREPARED.value,
                transaction_hash=None,
                idempotency_key=request.idempotency_key,
            )
        saved = await repository_call(
            repository.save_pool_transaction, user.wallet_address, transaction
        )
        return self._response(saved)

    async def sync(
        self,
        user: AuthenticatedUser,
        transaction_id: UUID,
        status_value: str,
        transaction_hash: str | None,
    ) -> PoolTransactionResponse:
        repository = get_repository()
        transaction = await repository_call(
            repository.find_pool_transaction_by_idempotency,
            user.wallet_address,
            "",
        )
        if transaction is None or transaction.id != transaction_id:
            transaction = await self._find_transaction(user, transaction_id)
        if transaction is None:
            raise HTTPException(status_code=404, detail="Pool transaction not found.")
        if transaction.status == TransactionStatus.CONFIRMED.value:
            return self._response(transaction)
        if status_value == TransactionStatus.CONFIRMED.value and not transaction_hash:
            raise HTTPException(status_code=422, detail="A confirmed transaction requires a transaction hash.")
        transaction.status = status_value
        transaction.transaction_hash = transaction_hash
        if status_value == TransactionStatus.CONFIRMED.value:
            position = await repository_call(repository.get_lender_position, user.wallet_address)
            if transaction.transaction_type == PoolTransactionType.DEPOSIT.value:
                position.deposited_amount = float(position.deposited_amount) + float(transaction.amount)
            else:
                position.withdrawn_amount = float(position.withdrawn_amount) + float(transaction.amount)
            await self._save_position(position)
        saved = await repository_call(repository.update_pool_transaction, transaction)
        return self._response(saved)

    async def _find_transaction(self, user: AuthenticatedUser, transaction_id: UUID):
        repository = get_repository()
        if hasattr(repository, "store"):
            return next(
                (
                    value
                    for (wallet, _), value in repository.store.pool_transactions.items()
                    if wallet == user.wallet_address.lower() and value.id == transaction_id
                ),
                None,
            )
        from sqlalchemy import select
        from app.models import PoolTransaction, User

        async with repository.session_factory() as session:
            return await session.scalar(
                select(PoolTransaction)
                .join(User, PoolTransaction.user_id == User.id)
                .where(PoolTransaction.id == transaction_id, User.wallet_address == user.wallet_address.lower())
            )

    async def _save_position(self, position) -> None:
        repository = get_repository()
        if hasattr(repository, "store"):
            repository.store.lender_positions[position.wallet_address] = position
            return
        async with repository.session_factory() as session:
            merged = await session.merge(position)
            await session.commit()

    @staticmethod
    def _response(transaction) -> PoolTransactionResponse:
        return PoolTransactionResponse(
            id=transaction.id,
            transaction_type=transaction.transaction_type,
            amount=float(transaction.amount),
            status=transaction.status,
            transaction_hash=transaction.transaction_hash,
            idempotency_key=transaction.idempotency_key,
        )


lender_service = LenderService()
