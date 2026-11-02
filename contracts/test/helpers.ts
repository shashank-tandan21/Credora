import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import type { Contract, ContractRunner } from "ethers";
import { network } from "hardhat";

import { DAY, deployProtocol, hashText, usdc, uuidToBytes32 } from "../scripts/lib/protocol.js";

export const { ethers, networkHelpers } = await network.create();

/** Typed `contract.connect(runner)`; ethers types the result as BaseContract. */
export function as(contract: Contract, runner: ContractRunner): Contract {
  return contract.connect(runner) as Contract;
}

export const ASSESSMENT_ID = uuidToBytes32("7f1c9a52-3d4e-4b6a-9c1d-2e3f4a5b6c7d");
export const SECOND_ASSESSMENT_ID = uuidToBytes32("0b9e8d7c-6f5a-4e3d-8c2b-1a0f9e8d7c6b");
/** Backend score 71.00 from docs/manual-testing.md, in basis points. */
export const SCORE_BPS = 7100;
export const PROFILE_HASH = hashText("8c1d4f6e-2a3b-4c5d-9e8f-7a6b5c4d3e2f");
export const REASON_HASH = hashText("Stipend deposit was delayed by four days.");
export const RESOLUTION_HASH = hashText("Verified payroll remittance; score adjusted.");

export async function latestTimestamp(): Promise<bigint> {
  return BigInt(await networkHelpers.time.latest());
}

export async function protocolFixture() {
  const [admin, operator, lender, borrower, other, outsider] = await ethers.getSigners();
  const protocol = await deployProtocol(ethers, { admin, operator: operator.address });
  for (const account of [lender, borrower, other]) {
    await (await as(protocol.mockUsdc, admin).mint(account.address, usdc(100_000))).wait();
  }
  return { ...protocol, admin, operator, lender, borrower, other, outsider };
}

export type ProtocolFixture = Awaited<ReturnType<typeof protocolFixture>>;

export async function approvePool(f: ProtocolFixture, signer: HardhatEthersSigner, amount: bigint): Promise<void> {
  await (await as(f.mockUsdc, signer).approve(await f.lendingPool.getAddress(), amount)).wait();
}

export async function depositToPool(f: ProtocolFixture, signer: HardhatEthersSigner, amount: bigint): Promise<void> {
  await approvePool(f, signer, amount);
  await (await as(f.lendingPool, signer).deposit(amount, signer.address)).wait();
}

export async function attestScore(
  f: ProtocolFixture,
  borrower: HardhatEthersSigner,
  assessmentId = ASSESSMENT_ID,
  scoreBps = SCORE_BPS,
  validity = 90n * DAY,
): Promise<bigint> {
  const expiresAt = (await latestTimestamp()) + validity;
  await (await as(f.creditScoreRegistry, f.operator).attest(borrower.address, assessmentId, scoreBps, expiresAt, 1)).wait();
  return expiresAt;
}

export async function fundedPoolFixture() {
  const f = await protocolFixture();
  await depositToPool(f, f.lender, usdc(10_000));
  return f;
}

export async function eligibleBorrowerFixture() {
  const f = await fundedPoolFixture();
  await (await as(f.identityRegistry, f.borrower).register(PROFILE_HASH)).wait();
  await attestScore(f, f.borrower);
  return f;
}

/** 500 mUSDC for 90 days, auto-funded: interest 14.794520, 3 installments. */
export async function activeLoanFixture() {
  const f = await eligibleBorrowerFixture();
  await (await as(f.loanManager, f.borrower).requestLoan(usdc(500), 90)).wait();
  await approvePool(f, f.borrower, usdc(100_000));
  const loan = await f.loanManager.getLoan(1n);
  return { ...f, loanId: 1n, fundedAt: loan.fundedAt as bigint };
}

/** Active loan advanced past installment 1 + grace and marked Overdue. */
export async function overdueLoanFixture() {
  const f = await activeLoanFixture();
  await networkHelpers.time.increaseTo(f.fundedAt + 33n * DAY);
  await (await as(f.loanManager, f.other).markOverdue(f.loanId)).wait();
  return f;
}
