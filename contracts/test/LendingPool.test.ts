import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import { expect } from "chai";
import { type Contract, id } from "ethers";

import { DAY, ROLES, usdc } from "../scripts/lib/protocol.js";
import {
  activeLoanFixture,
  as,
  depositToPool,
  ethers,
  fundedPoolFixture,
  networkHelpers,
  protocolFixture,
} from "./helpers.js";

const REENTRANCY_SELECTOR = id("ReentrancyGuardReentrantCall()").slice(0, 10);

async function reentrantPoolFixture() {
  const [admin, lender, borrower] = await ethers.getSigners();
  const token = (await ethers.deployContract("ReentrantToken")) as unknown as Contract;
  const pool = (await ethers.deployContract("LendingPool", [await token.getAddress(), admin.address])) as unknown as Contract;
  await as(pool, admin).grantRole(ROLES.LOAN_MANAGER, admin.address);
  await token.mint(lender.address, usdc(1_000));
  await token.mint(borrower.address, usdc(1_000));
  await as(token, lender).approve(await pool.getAddress(), usdc(1_000));
  await as(pool, lender).deposit(usdc(1_000), lender.address);
  return { token, pool, admin, lender, borrower };
}

describe("LendingPool", function () {
  describe("lender deposits and withdrawals", function () {
    it("mints shares 1:1 on the first deposit and tracks idle liquidity", async function () {
      const f = await networkHelpers.loadFixture(protocolFixture);
      await depositToPool(f, f.lender, usdc(10_000));

      expect(await f.lendingPool.balanceOf(f.lender.address)).to.equal(usdc(10_000));
      expect(await f.lendingPool.totalAssets()).to.equal(usdc(10_000));
      expect(await f.lendingPool.availableLiquidity()).to.equal(usdc(10_000));
      expect(await f.lendingPool.decimals()).to.equal(6n);
    });

    it("emits the ERC-4626 Deposit event", async function () {
      const f = await networkHelpers.loadFixture(protocolFixture);
      await as(f.mockUsdc, f.lender).approve(await f.lendingPool.getAddress(), usdc(100));
      await expect(as(f.lendingPool, f.lender).deposit(usdc(100), f.lender.address))
        .to.emit(f.lendingPool, "Deposit")
        .withArgs(f.lender.address, f.lender.address, usdc(100), usdc(100));
    });

    it("rejects zero-amount deposits, mints, withdrawals, and redemptions", async function () {
      const f = await networkHelpers.loadFixture(fundedPoolFixture);
      const pool = as(f.lendingPool, f.lender);
      await expect(pool.deposit(0n, f.lender.address)).to.be.revertedWithCustomError(f.lendingPool, "ZeroAmount");
      await expect(pool.mint(0n, f.lender.address)).to.be.revertedWithCustomError(f.lendingPool, "ZeroAmount");
      await expect(pool.withdraw(0n, f.lender.address, f.lender.address)).to.be.revertedWithCustomError(
        f.lendingPool,
        "ZeroAmount",
      );
      await expect(pool.redeem(0n, f.lender.address, f.lender.address)).to.be.revertedWithCustomError(
        f.lendingPool,
        "ZeroAmount",
      );
    });

    it("withdraws assets back to the lender", async function () {
      const f = await networkHelpers.loadFixture(fundedPoolFixture);
      await expect(as(f.lendingPool, f.lender).withdraw(usdc(4_000), f.lender.address, f.lender.address)).to.changeTokenBalances(
        ethers,
        f.mockUsdc,
        [f.lender, f.lendingPool],
        [usdc(4_000), -usdc(4_000)],
      );
      expect(await f.lendingPool.balanceOf(f.lender.address)).to.equal(usdc(6_000));
      expect(await f.lendingPool.availableLiquidity()).to.equal(usdc(6_000));
    });

    it("limits withdrawals to idle liquidity while loans are outstanding", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      const idle = await f.lendingPool.availableLiquidity();
      expect(idle).to.equal(usdc(9_500));
      expect(await f.lendingPool.maxWithdraw(f.lender.address)).to.equal(usdc(9_500));

      await expect(as(f.lendingPool, f.lender).withdraw(usdc(10_000), f.lender.address, f.lender.address))
        .to.be.revertedWithCustomError(f.lendingPool, "InsufficientLiquidity")
        .withArgs(usdc(10_000), idle);
      await expect(as(f.lendingPool, f.lender).redeem(usdc(10_000), f.lender.address, f.lender.address))
        .to.be.revertedWithCustomError(f.lendingPool, "InsufficientLiquidity")
        .withArgs(usdc(10_000), idle);
    });
  });

  describe("loan manager hooks", function () {
    it("restricts disbursement, repayment collection, and losses to LOAN_MANAGER_ROLE", async function () {
      const f = await networkHelpers.loadFixture(fundedPoolFixture);
      const pool = as(f.lendingPool, f.outsider);
      await expect(pool.disburse(1n, f.outsider.address, usdc(1)))
        .to.be.revertedWithCustomError(f.lendingPool, "AccessControlUnauthorizedAccount")
        .withArgs(f.outsider.address, ROLES.LOAN_MANAGER);
      await expect(pool.collectRepayment(1n, f.outsider.address, usdc(1), 0n)).to.be.revertedWithCustomError(
        f.lendingPool,
        "AccessControlUnauthorizedAccount",
      );
      await expect(pool.recordLoss(1n, usdc(1))).to.be.revertedWithCustomError(
        f.lendingPool,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("raises the share price when interest is repaid", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await as(f.loanManager, f.borrower).repayInFull(f.loanId);

      const interest = 14_794_520n;
      expect(await f.lendingPool.totalInterestEarned()).to.equal(interest);
      expect(await f.lendingPool.totalBorrowed()).to.equal(0n);
      expect(await f.lendingPool.totalAssets()).to.equal(usdc(10_000) + interest);
      // Virtual-share rounding leaves at most one unit in the pool.
      expect(await f.lendingPool.previewRedeem(usdc(10_000))).to.be.closeTo(usdc(10_000) + interest, 1n);
    });

    it("lowers the share price when a loss is recorded and rejects impossible losses", async function () {
      const f = await networkHelpers.loadFixture(fundedPoolFixture);
      await as(f.lendingPool, f.admin).grantRole(ROLES.LOAN_MANAGER, f.admin.address);
      const pool = as(f.lendingPool, f.admin);
      await pool.disburse(99n, f.outsider.address, usdc(1_000));

      await expect(pool.recordLoss(99n, usdc(1_001)))
        .to.be.revertedWithCustomError(f.lendingPool, "PrincipalExceedsBorrowed")
        .withArgs(usdc(1_001), usdc(1_000));
      await expect(pool.recordLoss(99n, usdc(400)))
        .to.emit(f.lendingPool, "LossRecorded")
        .withArgs(99n, usdc(400), anyValue);

      expect(await f.lendingPool.totalAssets()).to.equal(usdc(9_600));
      expect(await f.lendingPool.totalLosses()).to.equal(usdc(400));
      expect(await f.lendingPool.utilizationBps()).to.equal(625n); // 600 / 9600
    });

    it("rejects disbursements larger than idle liquidity", async function () {
      const f = await networkHelpers.loadFixture(fundedPoolFixture);
      await as(f.lendingPool, f.admin).grantRole(ROLES.LOAN_MANAGER, f.admin.address);
      await expect(as(f.lendingPool, f.admin).disburse(1n, f.outsider.address, usdc(10_001)))
        .to.be.revertedWithCustomError(f.lendingPool, "InsufficientLiquidity")
        .withArgs(usdc(10_001), usdc(10_000));
    });
  });

  describe("pause and emergency controls", function () {
    it("blocks deposits and withdrawals while paused but still accepts repayments", async function () {
      const f = await networkHelpers.loadFixture(activeLoanFixture);
      await as(f.lendingPool, f.admin).pause();
      await as(f.loanManager, f.admin).pause();

      expect(await f.lendingPool.maxDeposit(f.lender.address)).to.equal(0n);
      expect(await f.lendingPool.maxWithdraw(f.lender.address)).to.equal(0n);
      await expect(as(f.lendingPool, f.lender).deposit(usdc(1), f.lender.address)).to.be.revertedWithCustomError(
        f.lendingPool,
        "EnforcedPause",
      );
      await expect(as(f.lendingPool, f.lender).withdraw(usdc(1), f.lender.address, f.lender.address)).to.be.revertedWithCustomError(
        f.lendingPool,
        "EnforcedPause",
      );

      await expect(as(f.loanManager, f.borrower).repay(f.loanId, usdc(50))).to.emit(f.loanManager, "RepaymentMade");
    });

    it("ignores token donations in share pricing and only recovers the surplus", async function () {
      const f = await networkHelpers.loadFixture(fundedPoolFixture);
      const poolAddress = await f.lendingPool.getAddress();
      await as(f.mockUsdc, f.other).transfer(poolAddress, usdc(500));

      expect(await f.lendingPool.totalAssets()).to.equal(usdc(10_000));
      await expect(as(f.lendingPool, f.admin).recoverTokens(await f.mockUsdc.getAddress(), f.other.address, usdc(501)))
        .to.be.revertedWithCustomError(f.lendingPool, "RecoveryExceedsSurplus")
        .withArgs(usdc(501), usdc(500));
      await expect(
        as(f.lendingPool, f.admin).recoverTokens(await f.mockUsdc.getAddress(), f.other.address, usdc(500)),
      ).to.changeTokenBalance(ethers, f.mockUsdc, f.other, usdc(500));
      await expect(
        as(f.lendingPool, f.outsider).recoverTokens(await f.mockUsdc.getAddress(), f.outsider.address, 1n),
      ).to.be.revertedWithCustomError(f.lendingPool, "AccessControlUnauthorizedAccount");
    });
  });

  describe("reentrancy", function () {
    it("blocks re-entry during disbursement transfers", async function () {
      const { token, pool, admin, lender, borrower } = await networkHelpers.loadFixture(reentrantPoolFixture);
      await token.arm(await pool.getAddress(), pool.interface.encodeFunctionData("deposit", [1n, lender.address]));
      await expect(as(pool, admin).disburse(1n, borrower.address, usdc(10)))
        .to.be.revertedWithCustomError(token, "ReentryFailed")
        .withArgs(REENTRANCY_SELECTOR);
    });

    it("blocks re-entry during repayment collection", async function () {
      const { token, pool, admin, lender, borrower } = await networkHelpers.loadFixture(reentrantPoolFixture);
      await as(pool, admin).disburse(1n, borrower.address, usdc(10));
      await as(token, borrower).approve(await pool.getAddress(), usdc(10));
      await token.arm(
        await pool.getAddress(),
        pool.interface.encodeFunctionData("withdraw", [1n, lender.address, lender.address]),
      );
      await expect(as(pool, admin).collectRepayment(1n, borrower.address, usdc(10), 0n))
        .to.be.revertedWithCustomError(token, "ReentryFailed")
        .withArgs(REENTRANCY_SELECTOR);
    });
  });

  it("exposes a consistent dashboard snapshot", async function () {
    const f = await networkHelpers.loadFixture(activeLoanFixture);
    await networkHelpers.time.increase(DAY);
    const [assets, idle, borrowed, interestEarned, losses, utilization, shares] = await f.lendingPool.poolSnapshot();
    expect(assets).to.equal(idle + borrowed);
    expect(borrowed).to.equal(usdc(500));
    expect(interestEarned).to.equal(0n);
    expect(losses).to.equal(0n);
    expect(utilization).to.equal(500n); // 500 / 10,000 = 5%
    expect(shares).to.equal(usdc(10_000));
  });
});
