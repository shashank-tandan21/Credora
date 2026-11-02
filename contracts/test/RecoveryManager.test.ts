import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import { expect } from "chai";
import { ZeroHash } from "ethers";

import { DAY, LoanStatus, ROLES, usdc } from "../scripts/lib/protocol.js";
import {
  activeLoanFixture,
  as,
  latestTimestamp,
  networkHelpers,
  overdueLoanFixture,
  REASON_HASH,
  RESOLUTION_HASH,
} from "./helpers.js";

const RequestStatus = { Submitted: 1n, Approved: 2n, Rejected: 3n, Cancelled: 4n, Completed: 5n } as const;

async function submittedRequestFixture() {
  const f = await overdueLoanFixture();
  const outstanding = (await f.loanManager.outstanding(f.loanId)) as bigint;
  const proposedFinalDueAt = (await latestTimestamp()) + 90n * DAY;
  await as(f.recoveryManager, f.borrower).submitRequest(f.loanId, outstanding, proposedFinalDueAt, REASON_HASH);
  return { ...f, requestId: 1n, outstanding, proposedFinalDueAt };
}

async function approvedPlanFixture() {
  const f = await submittedRequestFixture();
  const now = await latestTimestamp();
  const first = f.outstanding / 2n;
  const second = f.outstanding - first;
  const dueDates = [now + 30n * DAY, now + 60n * DAY];
  await as(f.recoveryManager, f.operator).approveRequest(f.requestId, [first, second], dueDates, RESOLUTION_HASH);
  return { ...f, amounts: [first, second], dueDates };
}

describe("RecoveryManager", function () {
  describe("submitting requests", function () {
    it("records a restructuring request for an overdue loan", async function () {
      const f = await networkHelpers.loadFixture(overdueLoanFixture);
      const outstanding = await f.loanManager.outstanding(f.loanId);
      const dueAt = (await latestTimestamp()) + 90n * DAY;

      await expect(as(f.recoveryManager, f.borrower).submitRequest(f.loanId, outstanding, dueAt, REASON_HASH))
        .to.emit(f.recoveryManager, "RecoveryRequested")
        .withArgs(1n, f.loanId, f.borrower.address, outstanding, dueAt, REASON_HASH, anyValue);

      const request = await f.recoveryManager.getRequest(1n);
      expect(request.status).to.equal(RequestStatus.Submitted);
      expect(await f.recoveryManager.openRequestOf(f.loanId)).to.equal(1n);
    });

    it("accepts only eligible overdue loans owned by the caller", async function () {
      const active = await networkHelpers.loadFixture(activeLoanFixture);
      const dueAt = (await latestTimestamp()) + 90n * DAY;
      await expect(as(active.recoveryManager, active.borrower).submitRequest(active.loanId, usdc(600), dueAt, REASON_HASH))
        .to.be.revertedWithCustomError(active.recoveryManager, "LoanNotEligible")
        .withArgs(active.loanId);

      const f = await networkHelpers.loadFixture(overdueLoanFixture);
      await expect(as(f.recoveryManager, f.other).submitRequest(f.loanId, usdc(600), dueAt, REASON_HASH))
        .to.be.revertedWithCustomError(f.recoveryManager, "NotLoanBorrower")
        .withArgs(f.loanId, f.other.address);
    });

    it("rejects proposals that underpay, have invalid dates, or lack a reason", async function () {
      const f = await networkHelpers.loadFixture(overdueLoanFixture);
      const outstanding = (await f.loanManager.outstanding(f.loanId)) as bigint;
      const now = await latestTimestamp();
      const recovery = as(f.recoveryManager, f.borrower);

      await expect(recovery.submitRequest(f.loanId, outstanding - 1n, now + 90n * DAY, REASON_HASH))
        .to.be.revertedWithCustomError(f.recoveryManager, "ProposalUnderpays")
        .withArgs(outstanding - 1n, outstanding);
      await expect(recovery.submitRequest(f.loanId, outstanding, now, REASON_HASH)).to.be.revertedWithCustomError(
        f.recoveryManager,
        "InvalidDueDate",
      );
      await expect(recovery.submitRequest(f.loanId, outstanding, now + 400n * DAY, REASON_HASH)).to.be.revertedWithCustomError(
        f.recoveryManager,
        "InvalidDueDate",
      );
      await expect(recovery.submitRequest(f.loanId, outstanding, now + 90n * DAY, ZeroHash)).to.be.revertedWithCustomError(
        f.recoveryManager,
        "InvalidReasonHash",
      );
    });

    it("allows one open request per loan", async function () {
      const f = await networkHelpers.loadFixture(submittedRequestFixture);
      await expect(
        as(f.recoveryManager, f.borrower).submitRequest(f.loanId, f.outstanding, f.proposedFinalDueAt, REASON_HASH),
      )
        .to.be.revertedWithCustomError(f.recoveryManager, "RequestAlreadyOpen")
        .withArgs(f.loanId, f.requestId);
    });

    it("lets only the borrower cancel a submitted request", async function () {
      const f = await networkHelpers.loadFixture(submittedRequestFixture);
      await expect(as(f.recoveryManager, f.other).cancelRequest(f.requestId)).to.be.revertedWithCustomError(
        f.recoveryManager,
        "NotLoanBorrower",
      );
      await expect(as(f.recoveryManager, f.borrower).cancelRequest(f.requestId))
        .to.emit(f.recoveryManager, "RecoveryCancelled")
        .withArgs(f.requestId, f.loanId, f.borrower.address, anyValue);
      expect(await f.recoveryManager.openRequestOf(f.loanId)).to.equal(0n);
    });
  });

  describe("officer decisions", function () {
    it("lets an officer reject a request with a decision hash", async function () {
      const f = await networkHelpers.loadFixture(submittedRequestFixture);
      await expect(as(f.recoveryManager, f.operator).rejectRequest(f.requestId, ZeroHash)).to.be.revertedWithCustomError(
        f.recoveryManager,
        "InvalidReasonHash",
      );
      await expect(as(f.recoveryManager, f.operator).rejectRequest(f.requestId, RESOLUTION_HASH))
        .to.emit(f.recoveryManager, "RecoveryRejected")
        .withArgs(f.requestId, f.loanId, f.operator.address, RESOLUTION_HASH, anyValue);
      expect((await f.recoveryManager.getRequest(f.requestId)).status).to.equal(RequestStatus.Rejected);
      expect((await f.loanManager.getLoan(f.loanId)).status).to.equal(LoanStatus.Overdue);
    });

    it("restricts decisions to officers and forbids deciding on one's own loan", async function () {
      const f = await networkHelpers.loadFixture(submittedRequestFixture);
      await expect(as(f.recoveryManager, f.outsider).rejectRequest(f.requestId, RESOLUTION_HASH))
        .to.be.revertedWithCustomError(f.recoveryManager, "AccessControlUnauthorizedAccount")
        .withArgs(f.outsider.address, ROLES.RECOVERY_OFFICER);

      await as(f.recoveryManager, f.admin).grantRole(ROLES.RECOVERY_OFFICER, f.borrower.address);
      await expect(as(f.recoveryManager, f.borrower).rejectRequest(f.requestId, RESOLUTION_HASH))
        .to.be.revertedWithCustomError(f.recoveryManager, "OfficerConflict")
        .withArgs(f.borrower.address);
    });

    it("validates the milestone schedule", async function () {
      const f = await networkHelpers.loadFixture(submittedRequestFixture);
      const now = await latestTimestamp();
      const officer = as(f.recoveryManager, f.operator);
      const half = f.outstanding / 2n;
      const cases: [bigint[], bigint[]][] = [
        [[], []],
        [[half], [now + DAY, now + 2n * DAY]],
        [[0n, f.outstanding], [now + DAY, now + 2n * DAY]],
        [[half, f.outstanding - half], [now + 2n * DAY, now + DAY]],
        [Array(13).fill(usdc(100)), Array.from({ length: 13 }, (_, i) => now + BigInt(i + 1) * DAY)],
      ];
      for (const [amounts, dueDates] of cases) {
        await expect(officer.approveRequest(f.requestId, amounts, dueDates, RESOLUTION_HASH)).to.be.revertedWithCustomError(
          f.recoveryManager,
          "InvalidMilestones",
        );
      }
      await expect(officer.approveRequest(f.requestId, [half], [now + DAY], RESOLUTION_HASH))
        .to.be.revertedWithCustomError(f.loanManager, "RestructureUnderpays")
        .withArgs(half, f.outstanding);
    });

    it("approves a plan and restructures the loan", async function () {
      const f = await networkHelpers.loadFixture(submittedRequestFixture);
      const now = await latestTimestamp();
      const amounts = [usdc(300), f.outstanding - usdc(300) + usdc(5)];
      const dueDates = [now + 30n * DAY, now + 60n * DAY];
      const total = amounts[0] + amounts[1];

      const approval = as(f.recoveryManager, f.operator).approveRequest(f.requestId, amounts, dueDates, RESOLUTION_HASH);
      await expect(approval)
        .to.emit(f.recoveryManager, "RecoveryApproved")
        .withArgs(f.requestId, f.loanId, f.operator.address, total, 2n, RESOLUTION_HASH, anyValue);
      await expect(approval).to.emit(f.recoveryManager, "MilestoneScheduled").withArgs(f.requestId, 1n, amounts[1], dueDates[1]);
      await expect(approval)
        .to.emit(f.loanManager, "LoanRestructured")
        .withArgs(f.loanId, f.borrower.address, f.outstanding, total, dueDates[1], anyValue);

      const loan = await f.loanManager.getLoan(f.loanId);
      expect(loan.status).to.equal(LoanStatus.Restructured);
      expect(loan.finalDueAt).to.equal(dueDates[1]);
      expect(await f.loanManager.outstanding(f.loanId)).to.equal(total);
      expect(await f.recoveryManager.openRequestOf(f.loanId)).to.equal(f.requestId);
    });
  });

  describe("milestones and progress", function () {
    it("completes milestones in order from repayments made after approval", async function () {
      const f = await networkHelpers.loadFixture(approvedPlanFixture);
      const recovery = as(f.recoveryManager, f.outsider);
      expect(await f.recoveryManager.progressBps(f.requestId)).to.equal(0n);

      await expect(recovery.completeMilestone(f.requestId, 0))
        .to.be.revertedWithCustomError(f.recoveryManager, "MilestoneNotFunded")
        .withArgs(f.amounts[0], 0n);
      await expect(recovery.completeMilestone(f.requestId, 1))
        .to.be.revertedWithCustomError(f.recoveryManager, "MilestoneOutOfOrder")
        .withArgs(0n, 1n);

      await as(f.loanManager, f.borrower).repay(f.loanId, f.amounts[0]);
      await expect(recovery.completeMilestone(f.requestId, 0))
        .to.emit(f.recoveryManager, "MilestoneCompleted")
        .withArgs(f.requestId, 0n, f.amounts[0], anyValue);
      expect(await f.recoveryManager.progressBps(f.requestId)).to.equal(5_000n);

      await as(f.loanManager, f.borrower).repay(f.loanId, f.amounts[1]);
      await expect(recovery.completeMilestone(f.requestId, 1))
        .to.emit(f.recoveryManager, "RecoveryCompleted")
        .withArgs(f.requestId, f.loanId, f.borrower.address, anyValue);

      expect(await f.recoveryManager.progressBps(f.requestId)).to.equal(10_000n);
      expect((await f.recoveryManager.getRequest(f.requestId)).status).to.equal(RequestStatus.Completed);
      expect((await f.loanManager.getLoan(f.loanId)).status).to.equal(LoanStatus.Repaid);
      expect(await f.recoveryManager.openRequestOf(f.loanId)).to.equal(0n);
    });

    it("flags late milestones and overdue restructured loans", async function () {
      const f = await networkHelpers.loadFixture(approvedPlanFixture);
      expect(await f.recoveryManager.isMilestoneLate(f.requestId, 0)).to.equal(false);
      await networkHelpers.time.increaseTo(f.dueDates[0] + 1n);
      expect(await f.recoveryManager.isMilestoneLate(f.requestId, 0)).to.equal(true);
      expect(await f.loanManager.isOverdue(f.loanId)).to.equal(false);

      await networkHelpers.time.increaseTo(f.dueDates[1] + 3n * DAY);
      expect(await f.loanManager.isOverdue(f.loanId)).to.equal(true);
      await expect(as(f.loanManager, f.outsider).markOverdue(f.loanId)).to.emit(f.loanManager, "LoanOverdue");
    });

    it("settles an overdue restructured loan in full", async function () {
      const f = await networkHelpers.loadFixture(approvedPlanFixture);
      await networkHelpers.time.increaseTo(f.dueDates[1] + 3n * DAY);
      await as(f.loanManager, f.outsider).markOverdue(f.loanId);
      await as(f.loanManager, f.borrower).repayInFull(f.loanId);
      expect((await f.loanManager.getLoan(f.loanId)).status).to.equal(LoanStatus.Repaid);
    });
  });
});
