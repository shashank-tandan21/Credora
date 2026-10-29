from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.database import check_database_connection


router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "environment": settings.app_env}


@router.get("/health/readiness")
async def readiness_check() -> dict[str, str]:
    settings = get_settings()
    if settings.demo_mode:
        return {"status": "ready", "mode": "demo"}
    try:
        await check_database_connection()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not ready.",
        ) from exc
    return {"status": "ready", "mode": "production"}
