import re
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")
CHAIN_NETWORKS = {11155111: "sepolia", 31337: "hardhat-local"}


class Settings(BaseSettings):
    app_name: str = "REBOUND API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    demo_mode: bool = True
    database_url: str = ""
    sepolia_rpc_url: str = ""
    chain_id: int = 11155111
    chain_confirmations: int = Field(default=1, ge=1, le=64)
    chain_rpc_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    jwt_secret: str = Field(default="development-only-secret", min_length=16)
    auth_nonce_expiry_seconds: int = 600
    auth_domain: str = "localhost"
    auth_uri: str = "http://localhost:3000"

    mock_usdc_address: str = ""
    identity_registry_address: str = ""
    credit_score_registry_address: str = ""
    lending_pool_address: str = ""
    loan_manager_address: str = ""
    recovery_manager_address: str = ""
    dispute_manager_address: str = ""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    def contract_addresses(self) -> dict[str, str]:
        return {
            "mock_usdc": self.mock_usdc_address,
            "identity_registry": self.identity_registry_address,
            "credit_score_registry": self.credit_score_registry_address,
            "lending_pool": self.lending_pool_address,
            "loan_manager": self.loan_manager_address,
            "recovery_manager": self.recovery_manager_address,
            "dispute_manager": self.dispute_manager_address,
        }

    @property
    def network_name(self) -> str:
        return CHAIN_NETWORKS.get(self.chain_id, "unsupported")

    @property
    def contracts_configured(self) -> bool:
        return all(
            ADDRESS_PATTERN.fullmatch(address) for address in self.contract_addresses().values()
        )

    @property
    def chain_configured(self) -> bool:
        return bool(self.sepolia_rpc_url) and self.contracts_configured

    def validate_production_configuration(self) -> None:
        if self.demo_mode:
            return
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is required when DEMO_MODE=false.")
        if not self.database_url.startswith(("postgresql://", "postgresql+asyncpg://")):
            raise RuntimeError(
                "DATABASE_URL must be a PostgreSQL URL when DEMO_MODE=false."
            )
        if self.jwt_secret == "development-only-secret":
            raise RuntimeError("JWT_SECRET must be changed when DEMO_MODE=false.")
        if not self.sepolia_rpc_url:
            raise RuntimeError("SEPOLIA_RPC_URL is required when DEMO_MODE=false.")
        if self.chain_id not in CHAIN_NETWORKS:
            raise RuntimeError(f"CHAIN_ID {self.chain_id} is not a supported network.")
        invalid = [
            f"{name.upper()}_ADDRESS"
            for name, address in self.contract_addresses().items()
            if not ADDRESS_PATTERN.fullmatch(address)
        ]
        if invalid:
            raise RuntimeError(
                "Contract addresses are missing or invalid when DEMO_MODE=false: "
                + ", ".join(invalid)
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
