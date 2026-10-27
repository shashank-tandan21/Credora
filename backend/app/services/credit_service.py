from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status

from app.schemas.auth import AuthenticatedUser
from app.schemas.credit import (
    CreditAssessmentRequest,
    CreditAssessmentResponse,
    EvidenceResponse,
    EvidenceSubmissionRequest,
    ScoreComponent,
)
from app.services.demo_store import DemoAssessment, DemoEvidence, demo_store
from app.services.scoring_service import ScoreInputs, calculate_score


class CreditService:
    def add_evidence(
        self, user: AuthenticatedUser, request: EvidenceSubmissionRequest
    ) -> EvidenceResponse:
        evidence = DemoEvidence(
            id=uuid4(),
            wallet_address=user.wallet_address,
            evidence_type=request.evidence_type.strip(),
            period_months=request.period_months,
            repayment_history_score=request.repayment_history_score,
            affordability_score=request.affordability_score,
            cash_flow_stability_score=request.cash_flow_stability_score,
            debt_burden_score=request.debt_burden_score,
            evidence_quality_score=request.evidence_quality_score,
            notes=request.notes.strip() if request.notes else None,
            created_at=datetime.now(UTC),
        )
        demo_store.evidence_by_wallet.setdefault(user.wallet_address, []).append(evidence)
        return self._evidence_response(evidence)

    def list_evidence(self, user: AuthenticatedUser) -> list[EvidenceResponse]:
        return [
            self._evidence_response(item)
            for item in demo_store.evidence_by_wallet.get(user.wallet_address, [])
        ]

    def assess(
        self, user: AuthenticatedUser, request: CreditAssessmentRequest
    ) -> CreditAssessmentResponse:
        evidence = demo_store.evidence_by_wallet.get(user.wallet_address, [])
        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Submit at least one financial evidence record before assessment.",
            )

        latest = evidence[-1]
        result = calculate_score(
            ScoreInputs(
                latest.repayment_history_score,
                latest.affordability_score,
                latest.cash_flow_stability_score,
                latest.debt_burden_score,
                latest.evidence_quality_score,
            )
        )
        now = datetime.now(UTC)
        assessment = DemoAssessment(
            id=uuid4(),
            wallet_address=user.wallet_address,
            score=result.score,
            risk_category=result.risk_category,
            components=[
                {
                    "name": name,
                    "raw_score": raw,
                    "weight": {"Repayment history": 0.35, "Affordability": 0.25,
                               "Cash-flow stability": 0.15, "Debt burden": 0.15,
                               "Evidence quality": 0.10}[name],
                    "contribution": contribution,
                }
                for name, (raw, contribution) in result.contributions.items()
            ],
            explanation=result.explanation,
            valid_from=now,
            expires_at=now + timedelta(days=request.validity_days),
            status="active",
        )
        demo_store.assessments_by_wallet.setdefault(user.wallet_address, []).append(assessment)
        return self._assessment_response(assessment)

    def current(self, user: AuthenticatedUser) -> CreditAssessmentResponse:
        assessments = demo_store.assessments_by_wallet.get(user.wallet_address, [])
        if not assessments:
            raise HTTPException(status_code=404, detail="No credit assessment exists.")
        return self._assessment_response(assessments[-1])

    def history(self, user: AuthenticatedUser) -> list[CreditAssessmentResponse]:
        return [
            self._assessment_response(item)
            for item in reversed(demo_store.assessments_by_wallet.get(user.wallet_address, []))
        ]

    @staticmethod
    def _evidence_response(evidence: DemoEvidence) -> EvidenceResponse:
        return EvidenceResponse.model_validate(evidence, from_attributes=True)

    @staticmethod
    def _assessment_response(assessment: DemoAssessment) -> CreditAssessmentResponse:
        return CreditAssessmentResponse(
            id=assessment.id,
            score=assessment.score,
            risk_category=assessment.risk_category,  # type: ignore[arg-type]
            components=[ScoreComponent.model_validate(item) for item in assessment.components],
            explanation=assessment.explanation,
            academic_model=True,
            valid_from=assessment.valid_from,
            expires_at=assessment.expires_at,
            status=assessment.status,  # type: ignore[arg-type]
        )


credit_service = CreditService()
