from fastapi import APIRouter

from app.routes import auth, borrowers, chain, credit, health, lender, loans, pool, workflow


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(borrowers.router, tags=["borrowers"])
api_router.include_router(credit.router, tags=["credit"])
api_router.include_router(loans.router, tags=["loans"])
api_router.include_router(pool.router, tags=["pool"])
api_router.include_router(lender.router, tags=["lender"])
api_router.include_router(chain.router, tags=["chain"])
api_router.include_router(workflow.repayment_router, tags=["repayments"])
api_router.include_router(workflow.repayment_sync_router, tags=["repayments"])
api_router.include_router(workflow.recovery_router, tags=["recovery"])
api_router.include_router(workflow.dispute_router, tags=["disputes"])
api_router.include_router(workflow.reviewer_router, tags=["reviewer"])
