import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import { expect } from "chai";

import { DAY, DEFAULT_LOAN_PARAMETERS, LoanStatus, ROLES, usdc } from "../scripts/lib/protocol.js";
import {
  activeLoanFixture,
  approvePool,
  as,
  ASSESSMENT_ID,
  attestScore,
  eligibleBorrowerFixture,
  ethers,
  fundedPoolFixture,
  latestTimestamp,
  networkHelpers,
  overdueLoanFixture,
  PROFILE_HASH,
  REASON_HASH,
} from "./helpers.js";

// 500 mUSDC, 90 days, 12% APR: 500 * 0.12 * 90 / 365 = 14.794520 (floored to 6 decimals)
const PRINCIPAL = usdc(500);
const INTEREST = 14_794_520n;
const TOTAL_DUE = PRINCIPAL + INTEREST;
const INSTALLMENT = TOTAL_DUE / 3n; // 171.598173
const FINAL_INSTALLMENT = TOTAL_DUE - INSTALLMENT * 2n; // 171.598174

describe("LoanManager", function () {
  describe("quotes and eligibility", function () {
    it("quotes with the documented interest and installment conventions", async function () {
      const { loanManager } = await networkHelpers.loadFixture(fundedPoolFixture);
      const [interest, totalDue, count, installment] = await loanManager.quote(PRINCIPAL, 90);
      expect(interest).to.equal(INTEREST);
      expect(totalDue).to.equal(TOTAL_DUE);
      expect(count).to.equal(3n);
      expect(installment).to.equal(INSTALLMENT);

      const [, , countFor100Days] = await loanManager.quote(PRINCIPAL, 100);
      expect(countFor100Days).to.equal(4n);
      await expect(loanManager.quote(PRINCIPAL, 29)).to.be.revertedWithCustomError(loanManager, "InvalidDuration");
    });

    it("derives the limit as score x 15 MockUSDC, matching the backend (71.00 -> 1,065)", async function () {
      const { loanManager, borrower } = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      const [limit, scoreBps, assessmentId, valid] = await loanManager.eligibility(borrower.address);
      expect(limit).to.equal(usdc(1_065));
      expect(scoreBps).to.equal(7100n);
      expect(assessmentId).to.equal(ASSESSMENT_ID);
      expect(valid).to.equal(true);
    });

    it("caps the limit at maxPrincipal", async function () {
      // With the default x15 multiplier even a perfect score (1,500) stays below the cap,
      // so raise the multiplier to x30 to exercise it.
      const f = await networkHelpers.loadFixture(fundedPoolFixture);
      await as(f.loanManager, f.admin).setParameters({ ...DEFAULT_LOAN_PARAMETERS, limitPerScoreBps: 300_000n });
      await as(f.identityRegistry, f.borrower).register(PROFILE_HASH);
      await attestScore(f, f.borrower, ASSESSMENT_ID, 9900);
      const [limit] = await f.loanManager.eligibility(f.borrower.address);
      expect(limit).to.equal(usdc(2_000));
    });
  });

  describe("requesting and funding", function () {
    it("auto-funds and disburses a request when liquidity is available", async function () {
      const f = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      const request = as(f.loanManager, f.borrower).requestLoan(PRINCIPAL, 90);

      await expect(request)
        .to.emit(f.loanManager, "LoanRequested")
        .withArgs(1n, f.borrower.address, ASSESSMENT_ID, PRINCIPAL, INTEREST, 90n, 3n, anyValue);
      const fundedAt = await latestTimestamp();
      await expect(request)
        .to.emit(f.loanManager, "LoanFunded")
        .withArgs(1n, f.borrower.address, await f.loanManager.getAddress(), PRINCIPAL, fundedAt + 90n * DAY, fundedAt);
      await expect(request).to.emit(f.lendingPool, "LoanDisbursed").withArgs(1n, f.borrower.address, PRINCIPAL, fundedAt);

      const loan = await f.loanManager.getLoan(1n);
      expect(loan.status).to.equal(LoanStatus.Active);
      expect(loan.principal).to.equal(PRINCIPAL);
      expect(loan.interest).to.equal(INTEREST);
      expect(loan.installmentCount).to.equal(3n);
      expect(await f.loanManager.openLoanOf(f.borrower.address)).to.equal(1n);
      expect(await f.loanManager.loansOf(f.borrower.address)).to.deep.equal([1n]);
      expect(await f.lendingPool.totalBorrowed()).to.equal(PRINCIPAL);
    });

    it("transfers the principal to the borrower", async function () {
      const f = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      await expect(as(f.loanManager, f.borrower).requestLoan(PRINCIPAL, 90)).to.changeTokenBalances(
        ethers,
        f.mockUsdc,
        [f.borrower, f.lendingPool],
        [PRINCIPAL, -PRINCIPAL],
      );
    });

    it("rejects ineligible requests with explicit errors", async function () {
      const f = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      const asBorrower = as(f.loanManager, f.borrower);

      await expect(as(f.loanManager, f.outsider).requestLoan(PRINCIPAL, 90))
        .to.be.revertedWithCustomError(f.loanManager, "IdentityNotRegistered")
        .withArgs(f.outsider.address);
      await expect(asBorrower.requestLoan(PRINCIPAL, 29))
        .to.be.revertedWithCustomError(f.loanManager, "InvalidDuration")
        .withArgs(29n);
      await expect(asBorrower.requestLoan(PRINCIPAL, 366)).to.be.revertedWithCustomError(f.loanManager, "InvalidDuration");
      await expect(asBorrower.requestLoan(0n, 90))
        .to.be.revertedWithCustomError(f.loanManager, "PrincipalOutOfRange")
        .withArgs(0n, DEFAULT_LOAN_PARAMETERS.minPrincipal, DEFAULT_LOAN_PARAMETERS.maxPrincipal);
      await expect(asBorrower.requestLoan(usdc(1_066), 90))
        .to.be.revertedWithCustomError(f.loanManager, "ExceedsEligibleLimit")
        .withArgs(usdc(1_066), usdc(1_065));
    });

    it("requires a valid, unexpired credit attestation", async function () {
      const f = await networkHelpers.loadFixture(fundedPoolFixture);
      await as(f.identityRegistry, f.borrower).register(PROFILE_HASH);
      await expect(as(f.loanManager, f.borrower).requestLoan(PRINCIPAL, 90))
        .to.be.revertedWithCustomError(f.loanManager, "NoValidCreditScore")
        .withArgs(f.borrower.address);

      const expiresAt = await attestScore(f, f.borrower, ASSESSMENT_ID, 7100, DAY);
      await networkHelpers.time.increaseTo(expiresAt);
      await expect(as(f.loanManager, f.borrower).requestLoan(PRINCIPAL, 90)).to.be.revertedWithCustomError(
        f.loanManager,
        "NoValidCreditScore",
      );
    });

    it("prevents duplicate open loans for the same borrower", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await expect(as(f.loanManager, f.borrower).requestLoan(usdc(100), 30))
        .to.be.revertedWithCustomError(f.loanManager, "OpenLoanExists")
        .withArgs(f.borrower.address, 1n);
    });

    it("queues the request when liquidity is insufficient and lets a funder fund it", async function () {
      const f = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      await as(f.lendingPool, f.lender).withdraw(usdc(9_800), f.lender.address, f.lender.address);

      await expect(as(f.loanManager, f.borrower).requestLoan(PRINCIPAL, 90)).to.not.emit(f.loanManager, "LoanFunded");
      expect((await f.loanManager.getLoan(1n)).status).to.equal(LoanStatus.Requested);

      await expect(as(f.loanManager, f.operator).fundLoan(1n))
        .to.be.revertedWithCustomError(f.lendingPool, "InsufficientLiquidity")
        .withArgs(PRINCIPAL, usdc(200));

      await approvePool(f, f.lender, usdc(1_000));
      await as(f.lendingPool, f.lender).deposit(usdc(1_000), f.lender.address);
      await expect(as(f.loanManager, f.outsider).fundLoan(1n))
        .to.be.revertedWithCustomError(f.loanManager, "AccessControlUnauthorizedAccount")
        .withArgs(f.outsider.address, ROLES.FUNDER);
      await expect(as(f.loanManager, f.operator).fundLoan(1n))
        .to.emit(f.loanManager, "LoanFunded")
        .withArgs(1n, f.borrower.address, f.operator.address, PRINCIPAL, anyValue, anyValue);
      await expect(as(f.loanManager, f.operator).fundLoan(1n))
        .to.be.revertedWithCustomError(f.loanManager, "InvalidLoanStatus")
        .withArgs(1n, LoanStatus.Active);
    });

    it("refuses to fund expired requests or unknown loans", async function () {
      const f = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      await as(f.loanManager, f.admin).setParameters({ ...DEFAULT_LOAN_PARAMETERS, autoFund: false });
      await as(f.loanManager, f.borrower).requestLoan(PRINCIPAL, 90);
      const requestedAt = (await f.loanManager.getLoan(1n)).requestedAt as bigint;

      await networkHelpers.time.increaseTo(requestedAt + DEFAULT_LOAN_PARAMETERS.requestTtl + 1n);
      await expect(as(f.loanManager, f.operator).fundLoan(1n))
        .to.be.revertedWithCustomError(f.loanManager, "RequestExpired")
        .withArgs(1n, requestedAt + DEFAULT_LOAN_PARAMETERS.requestTtl);
      await expect(as(f.loanManager, f.operator).fundLoan(42n))
        .to.be.revertedWithCustomError(f.loanManager, "LoanNotFound")
        .withArgs(42n);
    });

    it("blocks new requests while paused", async function () {
      const f = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      await as(f.loanManager, f.admin).pause();
      await expect(as(f.loanManager, f.borrower).requestLoan(PRINCIPAL, 90)).to.be.revertedWithCustomError(
        f.loanManager,
        "EnforcedPause",
      );
    });
  });

  describe("cancellation", function () {
    async function requestedLoanFixture() {
      const f = await eligibleBorrowerFixture();
      await as(f.loanManager, f.admin).setParameters({ ...DEFAULT_LOAN_PARAMETERS, autoFund: false });
      await as(f.loanManager, f.borrower).requestLoan(PRINCIPAL, 90);
      return f;
    }

    it("lets the borrower cancel a requested loan and borrow again", async function () {
      const f = await networkHelpers.loadFixture(requestedLoanFixture);
      await expect(as(f.loanManager, f.borrower).cancelLoan(1n))
        .to.emit(f.loanManager, "LoanCancelled")
        .withArgs(1n, f.borrower.address, f.borrower.address, anyValue);
      expect((await f.loanManager.getLoan(1n)).status).to.equal(LoanStatus.Cancelled);
      expect(await f.loanManager.openLoanOf(f.borrower.address)).to.equal(0n);
      await as(f.loanManager, f.borrower).requestLoan(usdc(100), 30);
    });

    it("lets anyone cancel only after the request expires", async function () {
      const f = await networkHelpers.loadFixture(requestedLoanFixture);
      await expect(as(f.loanManager, f.outsider).cancelLoan(1n))
        .to.be.revertedWithCustomError(f.loanManager, "NotAuthorizedToCancel")
        .withArgs(1n, f.outsider.address);
      await networkHelpers.time.increase(DEFAULT_LOAN_PARAMETERS.requestTtl + 1n);
      await expect(as(f.loanManager, f.outsider).cancelLoan(1n)).to.emit(f.loanManager, "LoanCancelled");
    });

    it("cannot cancel a funded loan", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await expect(as(f.loanManager, f.borrower).cancelLoan(f.loanId))
        .to.be.revertedWithCustomError(f.loanManager, "InvalidLoanStatus")
        .withArgs(f.loanId, LoanStatus.Active);
    });
  });

  describe("repayment", function () {
    it("applies partial repayments to interest first, then principal", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      const asBorrower = as(f.loanManager, f.borrower);

      await expect(asBorrower.repay(f.loanId, usdc(10)))
        .to.emit(f.loanManager, "RepaymentMade")
        .withArgs(f.loanId, f.borrower.address, f.borrower.address, usdc(10), 0n, usdc(10), TOTAL_DUE - usdc(10), anyValue);
      expect(await f.lendingPool.totalBorrowed()).to.equal(PRINCIPAL);

      const remainingInterest = INTEREST - usdc(10);
      await expect(asBorrower.repay(f.loanId, usdc(20)))
        .to.emit(f.lendingPool, "RepaymentCollected")
        .withArgs(f.loanId, f.borrower.address, usdc(20) - remainingInterest, remainingInterest, anyValue);

      const loan = await f.loanManager.getLoan(f.loanId);
      expect(loan.interestRepaid).to.equal(INTEREST);
      expect(loan.principalRepaid).to.equal(usdc(20) - remainingInterest);
      expect(await f.loanManager.outstanding(f.loanId)).to.equal(TOTAL_DUE - usdc(30));
    });

    it("closes the loan on full repayment", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await expect(as(f.loanManager, f.borrower).repayInFull(f.loanId))
        .to.emit(f.loanManager, "LoanRepaid")
        .withArgs(f.loanId, f.borrower.address, TOTAL_DUE, anyValue);

      const loan = await f.loanManager.getLoan(f.loanId);
      expect(loan.status).to.equal(LoanStatus.Repaid);
      expect(loan.closedAt).to.be.greaterThan(0n);
      expect(await f.loanManager.outstanding(f.loanId)).to.equal(0n);
      expect(await f.loanManager.openLoanOf(f.borrower.address)).to.equal(0n);
      expect(await f.lendingPool.totalBorrowed()).to.equal(0n);
      expect(await f.lendingPool.totalInterestEarned()).to.equal(INTEREST);
    });

    it("rejects zero, excessive, and post-closure repayments", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      const asBorrower = as(f.loanManager, f.borrower);
      await expect(asBorrower.repay(f.loanId, 0n)).to.be.revertedWithCustomError(f.loanManager, "ZeroAmount");
      await expect(asBorrower.repay(f.loanId, TOTAL_DUE + 1n))
        .to.be.revertedWithCustomError(f.loanManager, "RepaymentExceedsOutstanding")
        .withArgs(TOTAL_DUE + 1n, TOTAL_DUE);

      await asBorrower.repayInFull(f.loanId);
      await expect(asBorrower.repay(f.loanId, 1n))
        .to.be.revertedWithCustomError(f.loanManager, "InvalidLoanStatus")
        .withArgs(f.loanId, LoanStatus.Repaid);
    });

    it("requires the payer to approve the pool", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await expect(as(f.loanManager, f.other).repay(f.loanId, usdc(1))).to.be.revertedWithCustomError(
        f.mockUsdc,
        "ERC20InsufficientAllowance",
      );
    });

    it("accepts repayment on behalf of the borrower", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await approvePool(f, f.other, usdc(50));
      await expect(as(f.loanManager, f.other).repay(f.loanId, usdc(50)))
        .to.emit(f.loanManager, "RepaymentMade")
        .withArgs(f.loanId, f.borrower.address, f.other.address, usdc(50), anyValue, anyValue, anyValue, anyValue);
    });
  });

  describe("schedule, overdue, and cure", function () {
    it("reports the next installment and lets the final one absorb rounding", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      const asBorrower = as(f.loanManager, f.borrower);

      let [number, dueAt, amount] = await f.loanManager.nextPaymentDue(f.loanId);
      expect([number, dueAt, amount]).to.deep.equal([1n, f.fundedAt + 30n * DAY, INSTALLMENT]);

      await asBorrower.repay(f.loanId, INSTALLMENT);
      [number, dueAt, amount] = await f.loanManager.nextPaymentDue(f.loanId);
      expect([number, dueAt, amount]).to.deep.equal([2n, f.fundedAt + 60n * DAY, INSTALLMENT]);

      await asBorrower.repay(f.loanId, INSTALLMENT);
      [number, , amount] = await f.loanManager.nextPaymentDue(f.loanId);
      expect([number, amount]).to.deep.equal([3n, FINAL_INSTALLMENT]);
      expect(INSTALLMENT * 2n + FINAL_INSTALLMENT).to.equal(TOTAL_DUE);
    });

    it("is not overdue until an installment passes its due date plus grace", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      // Margin: the next transaction is mined one second after the latest block.
      await networkHelpers.time.increaseTo(f.fundedAt + 33n * DAY - 10n);
      expect(await f.loanManager.isOverdue(f.loanId)).to.equal(false);
      await expect(as(f.loanManager, f.other).markOverdue(f.loanId))
        .to.be.revertedWithCustomError(f.loanManager, "LoanNotOverdue")
        .withArgs(f.loanId);

      await networkHelpers.time.increaseTo(f.fundedAt + 33n * DAY);
      expect(await f.loanManager.isOverdue(f.loanId)).to.equal(true);
      expect(await f.loanManager.amountPastDue(f.loanId)).to.equal(INSTALLMENT);
    });

    it("lets anyone mark an overdue loan and cures it when the arrears are paid", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await networkHelpers.time.increaseTo(f.fundedAt + 40n * DAY);
      await expect(as(f.loanManager, f.outsider).markOverdue(f.loanId))
        .to.emit(f.loanManager, "LoanOverdue")
        .withArgs(f.loanId, f.borrower.address, INSTALLMENT, anyValue);
      expect((await f.loanManager.getLoan(f.loanId)).status).to.equal(LoanStatus.Overdue);
      expect(await f.loanManager.isEligibleForRecovery(f.loanId)).to.equal(true);

      await expect(as(f.loanManager, f.borrower).repay(f.loanId, INSTALLMENT))
        .to.emit(f.loanManager, "LoanCured")
        .withArgs(f.loanId, f.borrower.address, anyValue);
      expect((await f.loanManager.getLoan(f.loanId)).status).to.equal(LoanStatus.Active);
    });

    it("stays overdue after a partial payment that does not clear the arrears", async function () {
      const f = await networkHelpers.loadFixture(overdueLoanFixture);
      await expect(as(f.loanManager, f.borrower).repay(f.loanId, usdc(10))).to.not.emit(f.loanManager, "LoanCured");
      expect((await f.loanManager.getLoan(f.loanId)).status).to.equal(LoanStatus.Overdue);
    });

    it("requires the full balance once the final due date has passed", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await networkHelpers.time.increaseTo(f.fundedAt + 93n * DAY);
      expect(await f.loanManager.amountPastDue(f.loanId)).to.equal(TOTAL_DUE);
    });
  });

  describe("default", function () {
    it("writes off unrepaid principal after the default delay", async function () {
      const f = await networkHelpers.loadFixture(overdueLoanFixture);
      await as(f.loanManager, f.borrower).repay(f.loanId, usdc(100));
      const loan = await f.loanManager.getLoan(f.loanId);
      const eligibleAt = (loan.finalDueAt as bigint) + DEFAULT_LOAN_PARAMETERS.defaultAfter;

      await expect(as(f.loanManager, f.operator).markDefaulted(f.loanId))
        .to.be.revertedWithCustomError(f.loanManager, "DefaultNotReached")
        .withArgs(f.loanId, eligibleAt);

      await networkHelpers.time.increaseTo(eligibleAt);
      const expectedLoss = PRINCIPAL - (usdc(100) - INTEREST);
      await expect(as(f.loanManager, f.outsider).markDefaulted(f.loanId)).to.be.revertedWithCustomError(
        f.loanManager,
        "AccessControlUnauthorizedAccount",
      );
      await expect(as(f.loanManager, f.operator).markDefaulted(f.loanId))
        .to.emit(f.loanManager, "LoanDefaulted")
        .withArgs(f.loanId, f.borrower.address, expectedLoss, anyValue);

      expect((await f.loanManager.getLoan(f.loanId)).status).to.equal(LoanStatus.Defaulted);
      expect(await f.lendingPool.totalLosses()).to.equal(expectedLoss);
      expect(await f.lendingPool.totalBorrowed()).to.equal(0n);
      expect(await f.loanManager.openLoanOf(f.borrower.address)).to.equal(0n);
    });

    it("only defaults loans that are marked overdue", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await expect(as(f.loanManager, f.operator).markDefaulted(f.loanId))
        .to.be.revertedWithCustomError(f.loanManager, "InvalidLoanStatus")
        .withArgs(f.loanId, LoanStatus.Active);
    });
  });

  describe("restructuring and administration", function () {
    it("restricts restructure to the RecoveryManager role", async function () {
      const f = await networkHelpers.loadFixture(overdueLoanFixture);
      const dueAt = (await latestTimestamp()) + 60n * DAY;
      await expect(as(f.loanManager, f.operator).restructure(f.loanId, TOTAL_DUE, dueAt))
        .to.be.revertedWithCustomError(f.loanManager, "AccessControlUnauthorizedAccount")
        .withArgs(f.operator.address, ROLES.RECOVERY_MANAGER);
    });

    it("validates parameter updates and restricts them to the admin", async function () {
      const { loanManager, admin, outsider } = await networkHelpers.loadFixture(fundedPoolFixture);
      await expect(as(loanManager, outsider).setParameters(DEFAULT_LOAN_PARAMETERS)).to.be.revertedWithCustomError(
        loanManager,
        "AccessControlUnauthorizedAccount",
      );
      for (const invalid of [
        { annualRateBps: 0 },
        { annualRateBps: 5_001 },
        { limitPerScoreBps: 0n },
        { minPrincipal: 0n },
        { minPrincipal: usdc(3_000) },
        { gracePeriod: 31n * DAY },
        { requestTtl: 60n },
        { defaultAfter: DAY },
      ]) {
        await expect(as(loanManager, admin).setParameters({ ...DEFAULT_LOAN_PARAMETERS, ...invalid })).to.be.revertedWithCustomError(
          loanManager,
          "InvalidParameters",
        );
      }
      await expect(as(loanManager, admin).setParameters({ ...DEFAULT_LOAN_PARAMETERS, annualRateBps: 1500 })).to.emit(
        loanManager,
        "LoanParametersUpdated",
      );
      expect((await loanManager.parameters()).annualRateBps).to.equal(1500n);
    });

    it("keeps the agreed rate on existing loans after a rate change", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await as(f.loanManager, f.admin).setParameters({ ...DEFAULT_LOAN_PARAMETERS, annualRateBps: 2400 });
      const loan = await f.loanManager.getLoan(f.loanId);
      expect(loan.annualRateBps).to.equal(1200n);
      expect(loan.interest).to.equal(INTEREST);
    });

    it("treats a revoked identity as ineligible at funding time", async function () {
      const f = await networkHelpers.loadFixture(eligibleBorrowerFixture);
      await as(f.loanManager, f.admin).setParameters({ ...DEFAULT_LOAN_PARAMETERS, autoFund: false });
      await as(f.loanManager, f.borrower).requestLoan(PRINCIPAL, 90);
      await as(f.identityRegistry, f.operator).revoke(f.borrower.address, REASON_HASH);
      await expect(as(f.loanManager, f.operator).fundLoan(1n))
        .to.be.revertedWithCustomError(f.loanManager, "IdentityNotRegistered")
        .withArgs(f.borrower.address);
    });
  });
});
