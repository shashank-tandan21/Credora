from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "REBOUND API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    demo_mode: bool = True
    database_url: str = "postgresql+asyncpg://rebound:rebound@localhost:5432/rebound"
    sepolia_rpc_url: str = ""
    chain_id: int = 11155111
    jwt_secret: str = Field(default="development-only-secret", min_length=16)
    auth_nonce_expiry_seconds: int = 600

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
