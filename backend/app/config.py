from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "REBOUND API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    demo_mode: bool = True
    database_url: str = ""
    sepolia_rpc_url: str = ""
    chain_id: int = 11155111
    jwt_secret: str = Field(default="development-only-secret", min_length=16)
    auth_nonce_expiry_seconds: int = 600

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
