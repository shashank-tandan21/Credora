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
    def get_profile(self, wallet_address: str) -> object | None:
        raise NotImplementedError

    @abstractmethod
    def create_profile(self, profile: object) -> object:
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
