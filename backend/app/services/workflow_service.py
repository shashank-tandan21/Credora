import json
from datetime import UTC, date, datetime, time
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from app.config import get_settings
from app.models import (
    AuditRecord,
    Dispute,
    RecoveryMilestone,
    RecoveryRequest,
    Repayment,
)
from app.repositories import demo_store, get_repository
from app.repositories.demo import DemoDispute, DemoRecoveryRequest, DemoRepayment
from app.schemas.auth import AuthenticatedUser
from app.schemas.workflow import (
    DisputeCreate,
    DisputeResolve,
    DisputeResponse,
    RecoveryMilestoneCreate,
    RecoveryMilestoneResponse,
    RecoveryProgressResponse,
    RecoveryRequestCreate,
    RecoveryRequestResponse,
    RepaymentPrepareRequest,
    RepaymentQuoteRequest,
    RepaymentResponse,
    RepaymentSyncRequest,
)
from app.services.repository_support import repository_call


def _not_found(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)


class WorkflowService:
    @property
    def repository(self):
        return get_repository()

    @property
    def demo_mode(self) -> bool:
        return get_settings().demo_mode

    async def _loan(self, user: AuthenticatedUser, loan_id: UUID):
        loan = await repository_call(self.repository.get_loan, user.wallet_address, loan_id)
        if loan is None:
            raise _not_found("Loan was not found.")
        return loan

    @staticmethod
    def _installments(loan) -> list[dict[str, object]]:
        if isinstance(loan.installments, str):
            return json.loads(loan.installments)
        return loan.installments

    def _installment(self, loan, number: int) -> dict[str, object]:
        for item in self._installments(loan):
            if item["installment_number"] == number:
                return item
        raise _not_found("Repayment installment was not found.")

    @staticmethod
    def _due_at(installment: dict[str, object]) -> datetime:
        return datetime.combine(
            date.fromisoformat(str(installment["due_date"])), time.min, tzinfo=UTC
        )

    async def quote_repayment(
        self, user: AuthenticatedUser, loan_id: UUID, request: RepaymentQuoteRequest
    ) -> RepaymentResponse:
        loan = await self._loan(user, loan_id)
        installment = self._installment(loan, request.installment_number)
        existing = await repository_call(
            self.repository.list_repayments, user.wallet_address, loan_id
        )
        if any(
            item.installment_number == request.installment_number
            and item.status == "confirmed"
            for item in existing
        ):
            raise HTTPException(status_code=409, detail="This installment is already paid.")
        return RepaymentResponse(
            id=uuid4(),
            loan_id=loan.id,
            installment_number=request.installment_number,
            amount=float(installment["amount"]),
            due_date=self._due_at(installment),
            status="prepared",
            transaction_hash=None,
            idempotency_key="quote",
            paid_at=None,
        )

    async def prepare_repayment(
        self, user: AuthenticatedUser, loan_id: UUID, request: RepaymentPrepareRequest
    ) -> RepaymentResponse:
        loan = await self._loan(user, loan_id)
        installment = self._installment(loan, request.installment_number)
        existing = await repository_call(
            self.repository.find_repayment_by_idempotency,
            user.wallet_address,
            request.idempotency_key,
        )
        if existing is not None:
            return self._repayment_response(existing)
        repayments = await repository_call(
            self.repository.list_repayments, user.wallet_address, loan_id
        )
        if any(
            item.installment_number == request.installment_number
            and item.status != "failed"
            for item in repayments
        ):
            raise HTTPException(status_code=409, detail="This installment already has a repayment.")
        if self.demo_mode:
            repayment = DemoRepayment(
                id=uuid4(),
                loan_id=loan.id,
                wallet_address=user.wallet_address,
                installment_number=request.installment_number,
                amount=float(installment["amount"]),
                due_date=self._due_at(installment),
                status="prepared",
                transaction_hash=None,
                idempotency_key=request.idempotency_key,
                created_at=datetime.now(UTC),
            )
        else:
            repayment = Repayment(
                loan_id=loan.id,
                installment_number=request.installment_number,
                principal_amount=Decimal(str(installment["amount"])),
                interest_amount=Decimal("0"),
                amount=Decimal(str(installment["amount"])),
                due_at=self._due_at(installment),
                status="prepared",
                idempotency_key=request.idempotency_key,
            )
        repayment = await repository_call(
            self.repository.save_repayment, user.wallet_address, repayment
        )
        return self._repayment_response(repayment)

    async def sync_repayment(
        self, user: AuthenticatedUser, repayment_id: UUID, request: RepaymentSyncRequest
    ) -> RepaymentResponse:
        repayment = await repository_call(
            self.repository.find_repayment, user.wallet_address, repayment_id
        )
        if repayment is None:
            raise _not_found("Repayment was not found.")
        if request.status == "confirmed" and not request.transaction_hash:
            raise HTTPException(
                status_code=422,
                detail="A confirmed repayment requires a transaction hash.",
            )
        if repayment.status == "confirmed":
            return self._repayment_response(repayment)
        repayment.status = request.status
        repayment.transaction_hash = request.transaction_hash
        if request.status == "confirmed":
            repayment.paid_at = datetime.now(UTC)
            if self.demo_mode:
                loan = await self._loan(user, repayment.loan_id)
                installments = self._installments(loan)
                for installment in installments:
                    if installment["installment_number"] == repayment.installment_number:
                        installment["status"] = "paid"
                if all(item.get("status") == "paid" for item in installments):
                    loan.status = "repaid"
                elif loan.status == "requested":
                    loan.status = "active"
            else:
                loan = await self._loan(user, repayment.loan_id)
                installments = self._installments(loan)
                for installment in installments:
                    if installment["installment_number"] == repayment.installment_number:
                        installment["status"] = "paid"
                loan.installments = json.dumps(installments)
                if all(item.get("status") == "paid" for item in installments):
                    loan.status = "repaid"
                elif loan.status == "requested":
                    loan.status = "active"
                await repository_call(self.repository.save_loan, user.wallet_address, loan)
        repayment = await repository_call(self.repository.update_repayment, repayment)
        return self._repayment_response(repayment)

    async def list_repayments(
        self, user: AuthenticatedUser, loan_id: UUID
    ) -> list[RepaymentResponse]:
        await self._loan(user, loan_id)
        repayments = await repository_call(
            self.repository.list_repayments, user.wallet_address, loan_id
        )
        return [self._repayment_response(item) for item in repayments]

    async def overdue_loans(self, user: AuthenticatedUser) -> list[UUID]:
        now = datetime.now(UTC)
        loans = await repository_call(self.repository.list_loans, user.wallet_address)
        return [
            loan.id
            for loan in loans
            if loan.status == "overdue"
            or any(
                item.get("status") != "paid"
                and self._due_at(item) < now
                for item in self._installments(loan)
            )
        ]

    async def create_recovery(
        self, user: AuthenticatedUser, request: RecoveryRequestCreate
    ) -> RecoveryRequestResponse:
        loan = await self._loan(user, request.loan_id)
        now = datetime.now(UTC)
        installments = self._installments(loan)
        overdue = loan.status == "overdue" or any(
            item.get("status") != "paid" and self._due_at(item) < now for item in installments
        )
        if not overdue:
            raise HTTPException(status_code=422, detail="Only overdue loans can enter recovery.")
        if request.proposed_due_date <= now:
            raise HTTPException(status_code=422, detail="The proposed due date must be in the future.")
        outstanding = sum(
            float(item["amount"]) for item in installments if item.get("status") != "paid"
        )
        if request.proposed_total < outstanding:
            raise HTTPException(
                status_code=422,
                detail="The proposed schedule cannot underpay the outstanding amount.",
            )
        existing = await repository_call(
            self.repository.list_recovery_requests, user.wallet_address
        )
        if any(item.loan_id == loan.id and item.status in {"submitted", "approved"} for item in existing):
            raise HTTPException(status_code=409, detail="An open recovery request already exists.")
        if self.demo_mode:
            recovery = DemoRecoveryRequest(
                id=uuid4(),
                loan_id=loan.id,
                wallet_address=user.wallet_address,
                proposed_total=request.proposed_total,
                proposed_due_date=request.proposed_due_date,
                reason=request.reason.strip(),
                status="submitted",
                created_at=now,
            )
        else:
            recovery = RecoveryRequest(
                loan_id=loan.id,
                proposed_total=Decimal(str(request.proposed_total)),
                proposed_due_at=request.proposed_due_date,
                reason=request.reason.strip(),
                status="submitted",
            )
        recovery = await repository_call(
            self.repository.save_recovery_request, user.wallet_address, recovery
        )
        return await self._recovery_response(recovery)

    async def list_recovery(self, user: AuthenticatedUser) -> list[RecoveryRequestResponse]:
        records = await repository_call(
            self.repository.list_recovery_requests, user.wallet_address
        )
        return [await self._recovery_response(item) for item in records]

    async def add_milestone(
        self, user: AuthenticatedUser, recovery_id: UUID, request: RecoveryMilestoneCreate
    ) -> RecoveryRequestResponse:
        recovery = await self._recovery(user, recovery_id)
        if recovery.status != "submitted":
            raise HTTPException(
                status_code=409,
                detail="Milestones can only be added to submitted requests.",
            )
        if request.due_date <= date.today():
            raise HTTPException(status_code=422, detail="Milestone due date must be in the future.")
        milestone_data = {
            "id": uuid4(),
            "title": request.title.strip(),
            "amount": request.amount,
            "due_date": request.due_date,
            "completed_at": None,
        }
        if self.demo_mode:
            recovery.milestones.append(milestone_data)
        else:
            milestone = RecoveryMilestone(
                id=milestone_data["id"],
                recovery_request_id=recovery.id,
                title=request.title.strip(),
                amount=Decimal(str(request.amount)),
                due_at=datetime.combine(request.due_date, time.min, tzinfo=UTC),
            )
            await repository_call(self.repository.save_recovery_milestone, milestone)
        recovery = await repository_call(
            self.repository.save_recovery_request, user.wallet_address, recovery
        )
        return await self._recovery_response(recovery)

    async def complete_milestone(
        self, user: AuthenticatedUser, milestone_id: UUID
    ) -> RecoveryRequestResponse:
        recovery = await repository_call(
            self.repository.find_recovery_by_milestone,
            user.wallet_address,
            milestone_id,
        )
        if recovery is None:
            raise _not_found("Recovery milestone was not found.")
        if self.demo_mode:
            milestone = next(m for m in recovery.milestones if m["id"] == milestone_id)
            if milestone["completed_at"] is not None:
                raise HTTPException(status_code=409, detail="Milestone is already complete.")
            milestone["completed_at"] = datetime.now(UTC)
            if recovery.milestones and all(m["completed_at"] is not None for m in recovery.milestones):
                recovery.status = "completed"
        else:
            milestone = next(m for m in recovery.milestones if m.id == milestone_id)
            if milestone.completed_at is not None:
                raise HTTPException(status_code=409, detail="Milestone is already complete.")
            milestone.completed_at = datetime.now(UTC)
            if recovery.milestones and all(m.completed_at is not None for m in recovery.milestones):
                recovery.status = "completed"
            await repository_call(self.repository.save_recovery_milestone, milestone)
        recovery = await repository_call(
            self.repository.save_recovery_request, user.wallet_address, recovery
        )
        return await self._recovery_response(recovery)

    async def recovery_progress(
        self, user: AuthenticatedUser, recovery_id: UUID
    ) -> RecoveryProgressResponse:
        recovery = await self._recovery(user, recovery_id)
        milestones = recovery.milestones
        completed = sum(
            (m["completed_at"] is not None if self.demo_mode else m.completed_at is not None)
            for m in milestones
        )
        total = len(milestones)
        return RecoveryProgressResponse(
            recovery_request_id=recovery.id,
            completed_milestones=completed,
            total_milestones=total,
            progress_percent=round(completed / total * 100, 2) if total else 0,
        )

    async def create_dispute(
        self, user: AuthenticatedUser, request: DisputeCreate
    ) -> DisputeResponse:
        assessments = await repository_call(
            self.repository.list_assessments, user.wallet_address
        )
        if not any(item.id == request.assessment_id for item in assessments):
            raise _not_found("Assessment was not found.")
        existing = await repository_call(
            self.repository.list_disputes, user.wallet_address, False
        )
        if any(item.assessment_id == request.assessment_id and item.status == "open" for item in existing):
            raise HTTPException(status_code=409, detail="An open dispute already exists.")
        if self.demo_mode:
            dispute = DemoDispute(
                id=uuid4(),
                assessment_id=request.assessment_id,
                wallet_address=user.wallet_address,
                reason=request.reason.strip(),
                status="open",
                resolution_notes=None,
                resolved_by=None,
                created_at=datetime.now(UTC),
            )
        else:
            dispute = Dispute(
                assessment_id=request.assessment_id,
                reason=request.reason.strip(),
                status="open",
            )
        dispute = await repository_call(self.repository.save_dispute, user.wallet_address, dispute)
        return self._dispute_response(dispute, user.wallet_address)

    async def list_disputes(self, user: AuthenticatedUser) -> list[DisputeResponse]:
        disputes = await repository_call(self.repository.list_disputes, user.wallet_address, False)
        return [self._dispute_response(item, user.wallet_address) for item in disputes]

    async def reviewer_queue(self, user: AuthenticatedUser) -> list[DisputeResponse]:
        self._require_reviewer(user)
        disputes = await repository_call(self.repository.list_disputes, None, True)
        return [self._dispute_response(item) for item in disputes]

    async def resolve_dispute(
        self, user: AuthenticatedUser, dispute_id: UUID, request: DisputeResolve
    ) -> DisputeResponse:
        self._require_reviewer(user)
        dispute = await repository_call(self.repository.get_dispute, dispute_id)
        if dispute is None:
            raise _not_found("Dispute was not found.")
        if dispute.status != "open":
            raise HTTPException(status_code=409, detail="Dispute is already resolved.")
        borrower_wallet = (
            dispute.wallet_address if self.demo_mode else dispute.borrower.wallet_address
        )
        if borrower_wallet == user.wallet_address:
            raise HTTPException(status_code=403, detail="Reviewers cannot resolve their own dispute.")
        dispute.status = request.status
        dispute.resolution_notes = request.resolution_notes.strip()
        dispute.resolved_at = datetime.now(UTC)
        if not self.demo_mode:
            reviewer = await repository_call(
                self.repository.get_or_create_user, user.wallet_address, user.role
            )
            dispute.resolved_by = reviewer.id
        dispute = await repository_call(self.repository.save_dispute, borrower_wallet, dispute)
        audit = AuditRecord(
            actor_user_id=None if self.demo_mode else dispute.resolved_by,
            action="dispute_resolved",
            resource_type="dispute",
            resource_id=dispute.id,
            details=json.dumps({"status": request.status, "notes": request.resolution_notes}),
        )
        await repository_call(self.repository.save_audit_record, audit)
        return self._dispute_response(dispute, borrower_wallet)

    async def _recovery(self, user: AuthenticatedUser, recovery_id: UUID):
        recovery = await repository_call(
            self.repository.get_recovery_request, user.wallet_address, recovery_id
        )
        if recovery is None:
            raise _not_found("Recovery request was not found.")
        return recovery

    @staticmethod
    def _require_reviewer(user: AuthenticatedUser) -> None:
        if user.role not in {"reviewer", "admin"}:
            raise HTTPException(status_code=403, detail="Reviewer role is required.")

    @staticmethod
    def _repayment_response(item) -> RepaymentResponse:
        return RepaymentResponse(
            id=item.id,
            loan_id=item.loan_id,
            installment_number=item.installment_number,
            amount=float(item.amount),
            due_date=item.due_date if hasattr(item, "due_date") else item.due_at,
            status=item.status,
            transaction_hash=item.transaction_hash,
            idempotency_key=item.idempotency_key,
            paid_at=item.paid_at,
        )

    async def _recovery_response(self, item) -> RecoveryRequestResponse:
        if self.demo_mode:
            milestones = [
                RecoveryMilestoneResponse(
                    id=m["id"],
                    title=m["title"],
                    amount=float(m["amount"]),
                    due_date=m["due_date"],
                    completed_at=m["completed_at"],
                )
                for m in item.milestones
            ]
            return RecoveryRequestResponse(
                id=item.id,
                loan_id=item.loan_id,
                proposed_total=item.proposed_total,
                proposed_due_date=item.proposed_due_date,
                reason=item.reason,
                status=item.status,
                created_at=item.created_at,
                milestones=milestones,
            )
        return RecoveryRequestResponse(
            id=item.id,
            loan_id=item.loan_id,
            proposed_total=float(item.proposed_total),
            proposed_due_date=item.proposed_due_at,
            reason=item.reason,
            status=item.status,
            created_at=item.created_at,
            milestones=[
                RecoveryMilestoneResponse(
                    id=m.id,
                    title=m.title,
                    amount=float(m.amount),
                    due_date=m.due_at.date(),
                    completed_at=m.completed_at,
                )
                for m in item.milestones
            ],
        )

    @staticmethod
    def _dispute_response(item, wallet_address: str | None = None) -> DisputeResponse:
        is_demo = isinstance(item, DemoDispute)
        return DisputeResponse(
            id=item.id,
            assessment_id=item.assessment_id,
            wallet_address=item.wallet_address if is_demo else (wallet_address or item.borrower.wallet_address),
            reason=item.reason,
            status=item.status,
            resolution_notes=item.resolution_notes,
            resolved_by=item.resolved_by if is_demo else None,
            created_at=item.created_at,
            resolved_at=item.resolved_at,
        )


workflow_service = WorkflowService()
