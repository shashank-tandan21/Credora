from fastapi import FastAPI

from app.api.router import api_router
from app.config import get_settings


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Backend API for the REBOUND academic micro-lending prototype.",
)


@app.get("/health", tags=["health"])
async def root_health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


app.include_router(api_router, prefix=settings.api_v1_prefix)
