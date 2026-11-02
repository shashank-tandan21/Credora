from fastapi import APIRouter

from app.routes import auth, borrowers, chain, credit, health, loans, pool


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(borrowers.router, tags=["borrowers"])
api_router.include_router(credit.router, tags=["credit"])
api_router.include_router(loans.router, tags=["loans"])
api_router.include_router(pool.router, tags=["pool"])
api_router.include_router(chain.router, tags=["chain"])
