from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID


class BaseRepository(ABC):
    @abstractmethod
    def get_or_create_user(self, wallet_address: str, role: str = "borrower") -> object:
        raise NotImplementedError

    @abstractmethod
    def create_token(self, wallet_address: str, token: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_user_for_token(self, token: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_user_role(self, wallet_address: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_profile(self, wallet_address: str) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def create_profile(self, profile: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def update_profile_identity(self, wallet_address: str, transaction_hash: str) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def list_evidence(self, wallet_address: str) -> list[object]:
        raise NotImplementedError

    @abstractmethod
    def save_evidence(self, wallet_address: str, evidence: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def current_assessment(self, wallet_address: str) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def list_assessments(self, wallet_address: str) -> list[object]:
        raise NotImplementedError

    @abstractmethod
    def save_assessment(self, wallet_address: str, assessment: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def list_loans(self, wallet_address: str) -> list[object]:
        raise NotImplementedError

    @abstractmethod
    def save_loan(self, wallet_address: str, loan: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def pool_statistics(self) -> dict[str, float | int]:
        raise NotImplementedError

    @abstractmethod
    def get_lender_position(self, wallet_address: str) -> object:
        raise NotImplementedError

    @abstractmethod
    def find_pool_transaction_by_idempotency(self, wallet_address: str, key: str) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def save_pool_transaction(self, wallet_address: str, transaction: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def update_pool_transaction(self, transaction: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def get_loan(self, wallet_address: str, loan_id: UUID) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def find_repayment_by_idempotency(self, wallet_address: str, key: str) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def find_repayment(self, wallet_address: str, repayment_id: UUID) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def list_repayments(self, wallet_address: str, loan_id: UUID) -> list[object]:
        raise NotImplementedError

    @abstractmethod
    def save_repayment(self, wallet_address: str, repayment: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def update_repayment(self, repayment: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def list_recovery_requests(self, wallet_address: str) -> list[object]:
        raise NotImplementedError

    @abstractmethod
    def get_recovery_request(self, wallet_address: str, recovery_id: UUID) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def save_recovery_request(self, wallet_address: str, recovery: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def save_recovery_milestone(self, milestone: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def find_recovery_by_milestone(self, wallet_address: str, milestone_id: UUID) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def save_dispute(self, wallet_address: str, dispute: object) -> object:
        raise NotImplementedError

    @abstractmethod
    def list_disputes(self, wallet_address: str | None = None, open_only: bool = False) -> list[object]:
        raise NotImplementedError

    @abstractmethod
    def get_dispute(self, dispute_id: UUID) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def save_audit_record(self, audit: object) -> object:
        raise NotImplementedError
