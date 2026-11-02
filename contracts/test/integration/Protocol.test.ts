import { expect } from "chai";
import { type Contract, type EventLog, getCreateAddress } from "ethers";
import { network } from "hardhat";

import {
  CONTRACT_NAMES,
  DAY,
  deployProtocol,
  hashText,
  LoanStatus,
  ROLES,
  seedLocalLiquidity,
  usdc,
  uuidToBytes32,
} from "../../scripts/lib/protocol.js";
import { as } from "../helpers.js";

const { ethers, networkHelpers } = await network.create();

async function localDeploymentFixture() {
  const signers = await ethers.getSigners();
  const [admin, lender, borrower, secondBorrower] = signers;
  const protocol = await deployProtocol(ethers, { admin });
  await seedLocalLiquidity(protocol, {
    admin,
    recipients: signers.slice(0, 5).map((signer) => signer.address),
  });
  const deployBlock = protocol.records.MockUSDC.blockNumber;
  return { ...protocol, admin, lender, borrower, secondBorrower, deployBlock };
}

async function events(contract: Contract, name: string, fromBlock: number): Promise<EventLog[]> {
  return (await contract.queryFilter(contract.getEvent(name), fromBlock, "latest")) as EventLog[];
}

function sum(logs: EventLog[], ...fields: string[]): bigint {
  return logs.reduce((total, log) => total + fields.reduce((acc, field) => acc + (log.args[field] as bigint), 0n), 0n);
}

describe("Protocol integration (local deployment)", function () {
  it("deploys to deterministic addresses from the default Hardhat deployer", async function () {
    const fresh = await network.create();
    const [deployer] = await fresh.ethers.getSigners();
    const protocol = await deployProtocol(fresh.ethers, { admin: deployer });

    expect(protocol.records.MockUSDC.address).to.equal("0x5FbDB2315678afecb367f032d93F642f64180aa3");
    CONTRACT_NAMES.forEach((name, nonce) => {
      expect(protocol.records[name].address).to.equal(getCreateAddress({ from: deployer.address, nonce }));
    });
    await fresh.close();
  });

  it("wires every protocol and operator role", async function () {
    const f = await networkHelpers.loadFixture(localDeploymentFixture);
    const operator = f.admin.address;
    expect(await f.lendingPool.hasRole(ROLES.LOAN_MANAGER, await f.loanManager.getAddress())).to.equal(true);
    expect(await f.loanManager.hasRole(ROLES.RECOVERY_MANAGER, await f.recoveryManager.getAddress())).to.equal(true);
    expect(await f.creditScoreRegistry.hasRole(ROLES.DISPUTE_MANAGER, await f.disputeManager.getAddress())).to.equal(true);
    expect(await f.identityRegistry.hasRole(ROLES.REGISTRAR, operator)).to.equal(true);
    expect(await f.creditScoreRegistry.hasRole(ROLES.ATTESTER, operator)).to.equal(true);
    expect(await f.loanManager.hasRole(ROLES.FUNDER, operator)).to.equal(true);
    expect(await f.recoveryManager.hasRole(ROLES.RECOVERY_OFFICER, operator)).to.equal(true);
    expect(await f.disputeManager.hasRole(ROLES.REVIEWER, operator)).to.equal(true);
    expect(await f.lendingPool.totalAssets()).to.equal(usdc(25_000));
  });

  it("runs the lender and borrower lifecycle and reconciles balances from events", async function () {
    const f = await networkHelpers.loadFixture(localDeploymentFixture);
    const poolAddress = await f.lendingPool.getAddress();

    await as(f.mockUsdc, f.lender).approve(poolAddress, usdc(5_000));
    await as(f.lendingPool, f.lender).deposit(usdc(5_000), f.lender.address);

    const assessmentId = uuidToBytes32("3f2504e0-4f89-11d3-9a0c-0305e82c3301");
    await as(f.identityRegistry, f.borrower).register(hashText("profile-borrower"));
    const expiresAt = BigInt(await networkHelpers.time.latest()) + 90n * DAY;
    await as(f.creditScoreRegistry, f.admin).attest(f.borrower.address, assessmentId, 7100, expiresAt, 1);
    await as(f.loanManager, f.borrower).requestLoan(usdc(500), 90);
    const loanId = await f.loanManager.openLoanOf(f.borrower.address);
    expect((await f.loanManager.getLoan(loanId)).status).to.equal(LoanStatus.Active);

    await as(f.mockUsdc, f.borrower).approve(poolAddress, usdc(1_000));
    for (;;) {
      const [installment, dueAt, amountDue] = await f.loanManager.nextPaymentDue(loanId);
      if (installment === 0n) break;
      await networkHelpers.time.increaseTo(dueAt - DAY);
      await as(f.loanManager, f.borrower).repay(loanId, amountDue);
      expect(await f.loanManager.isOverdue(loanId)).to.equal(false);
    }
    const loan = await f.loanManager.getLoan(loanId);
    expect(loan.status).to.equal(LoanStatus.Repaid);

    const lenderShares = await f.lendingPool.balanceOf(f.lender.address);
    const balanceBefore = await f.mockUsdc.balanceOf(f.lender.address);
    await as(f.lendingPool, f.lender).redeem(lenderShares, f.lender.address, f.lender.address);
    const redeemed = (await f.mockUsdc.balanceOf(f.lender.address)) - balanceBefore;
    expect(redeemed).to.be.greaterThan(usdc(5_000));

    // Event-sourced reconciliation: the pool's idle cash must equal the replayed ledger.
    const deposits = await events(f.lendingPool, "Deposit", f.deployBlock);
    const withdrawals = await events(f.lendingPool, "Withdraw", f.deployBlock);
    const disbursed = await events(f.lendingPool, "LoanDisbursed", f.deployBlock);
    const collected = await events(f.lendingPool, "RepaymentCollected", f.deployBlock);
    const replayedIdle =
      sum(deposits, "assets") - sum(withdrawals, "assets") - sum(disbursed, "principal") + sum(collected, "principal", "interest");

    expect(replayedIdle).to.equal(await f.lendingPool.totalIdle());
    expect(await f.mockUsdc.balanceOf(poolAddress)).to.equal(await f.lendingPool.totalIdle());
    expect(await f.lendingPool.totalAssets()).to.equal((await f.lendingPool.totalIdle()) + (await f.lendingPool.totalBorrowed()));
    expect(sum(collected, "interest")).to.equal(await f.lendingPool.totalInterestEarned());

    // The loan state can be rebuilt from LoanManager events alone.
    const repayments = (await events(f.loanManager, "RepaymentMade", f.deployBlock)).filter((log) => log.args.loanId === loanId);
    expect(repayments).to.have.length(3);
    expect(sum(repayments, "amount")).to.equal(loan.principal + loan.interest);
    expect(repayments.at(-1)?.args.outstanding).to.equal(0n);
    const [requested] = await events(f.loanManager, "LoanRequested", f.deployBlock);
    expect(requested.args.assessmentId).to.equal(assessmentId);
  });

  it("recovers an overdue loan through an approved restructuring plan", async function () {
    const f = await networkHelpers.loadFixture(localDeploymentFixture);
    const poolAddress = await f.lendingPool.getAddress();
    await as(f.identityRegistry, f.borrower).register(hashText("profile-borrower"));
    const expiresAt = BigInt(await networkHelpers.time.latest()) + 90n * DAY;
    await as(f.creditScoreRegistry, f.admin).attest(f.borrower.address, uuidToBytes32("9b2c1d4e-5f60-4718-8a9b-0c1d2e3f4a5b"), 6000, expiresAt, 1);
    await as(f.loanManager, f.borrower).requestLoan(usdc(600), 60);
    const loanId = await f.loanManager.openLoanOf(f.borrower.address);

    await networkHelpers.time.increase(35n * DAY);
    await as(f.loanManager, f.lender).markOverdue(loanId);
    const outstanding = (await f.loanManager.outstanding(loanId)) as bigint;
    const now = BigInt(await networkHelpers.time.latest());
    await as(f.recoveryManager, f.borrower).submitRequest(loanId, outstanding, now + 120n * DAY, hashText("Medical leave"));
    const requestId = await f.recoveryManager.openRequestOf(loanId);

    const amounts = [outstanding / 3n, outstanding / 3n, outstanding - (outstanding / 3n) * 2n];
    const dueDates = [now + 40n * DAY, now + 80n * DAY, now + 120n * DAY];
    await as(f.recoveryManager, f.admin).approveRequest(requestId, amounts, dueDates, hashText("Approved 3-step plan"));
    expect((await f.loanManager.getLoan(loanId)).status).to.equal(LoanStatus.Restructured);

    await as(f.mockUsdc, f.borrower).approve(poolAddress, outstanding);
    for (let index = 0; index < amounts.length; index++) {
      await networkHelpers.time.increaseTo(dueDates[index] - DAY);
      await as(f.loanManager, f.borrower).repay(loanId, amounts[index]);
      await as(f.recoveryManager, f.lender).completeMilestone(requestId, index);
    }

    expect(await f.recoveryManager.progressBps(requestId)).to.equal(10_000n);
    expect((await f.loanManager.getLoan(loanId)).status).to.equal(LoanStatus.Repaid);
    expect(await f.lendingPool.totalBorrowed()).to.equal(0n);
  });

  it("upholds a dispute, then lends against the corrected re-attested score", async function () {
    const f = await networkHelpers.loadFixture(localDeploymentFixture);
    const original = uuidToBytes32("11111111-2222-4333-8444-555555555555");
    const corrected = uuidToBytes32("66666666-7777-4888-9999-aaaaaaaaaaaa");
    await as(f.identityRegistry, f.secondBorrower).register(hashText("profile-second"));
    const expiresAt = BigInt(await networkHelpers.time.latest()) + 90n * DAY;
    await as(f.creditScoreRegistry, f.admin).attest(f.secondBorrower.address, original, 5000, expiresAt, 1);

    const [lowLimit] = await f.loanManager.eligibility(f.secondBorrower.address);
    expect(lowLimit).to.equal(usdc(750));

    await as(f.disputeManager, f.secondBorrower).openDispute(original, hashText("Payroll delay"));
    await as(f.disputeManager, f.admin).resolveDispute(1n, true, hashText("Upheld after payroll evidence"));
    await expect(as(f.loanManager, f.secondBorrower).requestLoan(usdc(100), 30)).to.be.revertedWithCustomError(
      f.loanManager,
      "NoValidCreditScore",
    );

    await as(f.creditScoreRegistry, f.admin).attest(f.secondBorrower.address, corrected, 6400, expiresAt, 1);
    const [newLimit] = await f.loanManager.eligibility(f.secondBorrower.address);
    expect(newLimit).to.equal(usdc(960));
    await expect(as(f.loanManager, f.secondBorrower).requestLoan(usdc(900), 120)).to.emit(f.loanManager, "LoanFunded");
  });
});
