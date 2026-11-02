import { expect } from "chai";
import { type Contract, ZeroAddress } from "ethers";

import { DEFAULT_LOAN_PARAMETERS, ROLES, usdc } from "../scripts/lib/protocol.js";
import { as, ethers, fundedPoolFixture, networkHelpers } from "./helpers.js";

async function expectZeroAddress(name: string, args: unknown[]): Promise<void> {
  const factory = await ethers.getContractFactory(name);
  await expect(factory.deploy(...args)).to.be.revertedWithCustomError(factory, "ZeroAddress");
}

describe("Constructor and input validation", function () {
  it("rejects zero addresses in every constructor", async function () {
    const f = await networkHelpers.loadFixture(fundedPoolFixture);
    const admin = f.admin.address;
    const pool = await f.lendingPool.getAddress();
    const scores = await f.creditScoreRegistry.getAddress();
    const identity = await f.identityRegistry.getAddress();

    await expectZeroAddress("MockUSDC", [ZeroAddress, true]);
    await expectZeroAddress("IdentityRegistry", [ZeroAddress]);
    await expectZeroAddress("CreditScoreRegistry", [admin, ZeroAddress]);
    await expectZeroAddress("LendingPool", [ZeroAddress, admin]);
    await expectZeroAddress("LoanManager", [admin, ZeroAddress, scores, identity, DEFAULT_LOAN_PARAMETERS]);
    await expectZeroAddress("LoanManager", [admin, pool, scores, ZeroAddress, DEFAULT_LOAN_PARAMETERS]);
    await expectZeroAddress("RecoveryManager", [ZeroAddress, await f.loanManager.getAddress()]);
    await expectZeroAddress("DisputeManager", [admin, ZeroAddress]);

    const factory = await ethers.getContractFactory("LoanManager");
    await expect(
      factory.deploy(admin, pool, scores, identity, { ...DEFAULT_LOAN_PARAMETERS, annualRateBps: 0 }),
    ).to.be.revertedWithCustomError(factory, "InvalidParameters");
  });

  it("validates LendingPool hook inputs", async function () {
    const f = await networkHelpers.loadFixture(fundedPoolFixture);
    await as(f.lendingPool, f.admin).grantRole(ROLES.LOAN_MANAGER, f.admin.address);
    const pool = as(f.lendingPool, f.admin);

    await expect(pool.disburse(1n, ZeroAddress, usdc(1))).to.be.revertedWithCustomError(f.lendingPool, "ZeroAddress");
    await expect(pool.disburse(1n, f.outsider.address, 0n)).to.be.revertedWithCustomError(f.lendingPool, "ZeroAmount");
    await expect(pool.collectRepayment(1n, f.outsider.address, 0n, 0n)).to.be.revertedWithCustomError(
      f.lendingPool,
      "ZeroAmount",
    );
    await expect(pool.collectRepayment(1n, f.outsider.address, usdc(1), 0n))
      .to.be.revertedWithCustomError(f.lendingPool, "PrincipalExceedsBorrowed")
      .withArgs(usdc(1), 0n);
    await expect(pool.recordLoss(1n, 0n)).to.be.revertedWithCustomError(f.lendingPool, "ZeroAmount");
    await expect(pool.recoverTokens(ZeroAddress, f.admin.address, 1n)).to.be.revertedWithCustomError(
      f.lendingPool,
      "ZeroAddress",
    );
    await expect(pool.recoverTokens(await f.mockUsdc.getAddress(), f.admin.address, 0n)).to.be.revertedWithCustomError(
      f.lendingPool,
      "ZeroAmount",
    );
  });

  it("supports share-denominated mint and redeem and reports zero limits while paused", async function () {
    const f = await networkHelpers.loadFixture(fundedPoolFixture);
    const pool = as(f.lendingPool, f.other);
    await as(f.mockUsdc, f.other).approve(await f.lendingPool.getAddress(), usdc(100));
    await pool.mint(usdc(100), f.other.address);
    expect(await f.lendingPool.balanceOf(f.other.address)).to.equal(usdc(100));
    expect(await f.lendingPool.maxRedeem(f.other.address)).to.equal(usdc(100));
    await pool.redeem(usdc(40), f.other.address, f.other.address);
    expect(await f.lendingPool.balanceOf(f.other.address)).to.equal(usdc(60));

    await as(f.lendingPool, f.admin).pause();
    expect(await f.lendingPool.maxMint(f.other.address)).to.equal(0n);
    expect(await f.lendingPool.maxRedeem(f.other.address)).to.equal(0n);
    await as(f.lendingPool, f.admin).unpause();
    expect(await f.lendingPool.maxMint(f.other.address)).to.be.greaterThan(0n);
  });

  it("pauses and unpauses every pausable contract only through PAUSER_ROLE", async function () {
    const f = await networkHelpers.loadFixture(fundedPoolFixture);
    const pausable: Contract[] = [
      f.identityRegistry,
      f.creditScoreRegistry,
      f.lendingPool,
      f.loanManager,
      f.recoveryManager,
      f.disputeManager,
    ];
    for (const contract of pausable) {
      await expect(as(contract, f.outsider).pause())
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
        .withArgs(f.outsider.address, ROLES.PAUSER);
      await as(contract, f.admin).pause();
      expect(await contract.paused()).to.equal(true);
      await as(contract, f.admin).unpause();
      expect(await contract.paused()).to.equal(false);
    }
  });

  it("returns empty values for unknown ids in views", async function () {
    const f = await networkHelpers.loadFixture(fundedPoolFixture);
    expect((await f.loanManager.getLoan(404n)).status).to.equal(0n);
    expect(await f.loanManager.outstanding(404n)).to.equal(0n);
    expect(await f.loanManager.nextPaymentDue(404n)).to.deep.equal([0n, 0n, 0n]);
    expect(await f.recoveryManager.progressBps(404n)).to.equal(0n);
    expect(await f.recoveryManager.getMilestones(404n)).to.deep.equal([]);
    expect(await f.recoveryManager.isMilestoneLate(404n, 0)).to.equal(false);
    await expect(as(f.recoveryManager, f.borrower).cancelRequest(404n))
      .to.be.revertedWithCustomError(f.recoveryManager, "RequestNotFound")
      .withArgs(404n);
    expect((await f.disputeManager.getDispute(404n)).status).to.equal(0n);
  });
});
