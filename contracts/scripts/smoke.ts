import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type Contract, type ContractTransactionResponse, parseEther, Wallet } from "ethers";
import { network } from "hardhat";

import {
  CONTRACT_NAMES,
  type ContractName,
  DAY,
  type DeploymentManifest,
  DEPLOYMENTS_DIR,
  hashText,
  LOCAL_CHAIN_ID,
  usdc,
  uuidToBytes32,
} from "./lib/protocol.js";

// End-to-end smoke test against an already-deployed network (localhost or sepolia).
// Every step waits for a successful receipt on the expected chain and records the
// transaction hash, block, gas, and timestamp as evidence. The borrower is an
// ephemeral wallet funded by the operator, so no extra secret is needed and the
// script can be re-run. The overdue/recovery flow needs time travel and only runs
// on the local Hardhat node.

interface Evidence {
  step: string;
  transactionHash: string;
  status: "confirmed";
  blockNumber: number;
  gasUsed: string;
  timestamp: string;
}

const { ethers, networkName } = await network.create();
const chainId = (await ethers.provider.getNetwork()).chainId;
const manifest = JSON.parse(
  await readFile(path.join(DEPLOYMENTS_DIR, `${networkName}.json`), "utf8"),
) as DeploymentManifest;
if (BigInt(manifest.chainId) !== chainId) {
  throw new Error(`Manifest chain ${manifest.chainId} does not match connected chain ${chainId}.`);
}

const [operator] = await ethers.getSigners();
const isLocal = chainId === LOCAL_CHAIN_ID;
const borrower = Wallet.createRandom().connect(ethers.provider);

const contracts = {} as Record<ContractName, Contract>;
for (const name of CONTRACT_NAMES) {
  contracts[name] = (await ethers.getContractAt(name, manifest.contracts[name].address)) as unknown as Contract;
}
const { MockUSDC, IdentityRegistry, CreditScoreRegistry, LendingPool, LoanManager, RecoveryManager, DisputeManager } =
  contracts;
const evidence: Evidence[] = [];

async function record(step: string, pending: Promise<ContractTransactionResponse>): Promise<void> {
  const transaction = await pending;
  const receipt = await transaction.wait();
  if (receipt === null || receipt.status !== 1) {
    throw new Error(`${step} failed: ${transaction.hash}`);
  }
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  evidence.push({
    step,
    transactionHash: transaction.hash,
    status: "confirmed",
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    timestamp: new Date(Number(block?.timestamp ?? 0) * 1000).toISOString(),
  });
  console.log(`  ✔ ${step.padEnd(40)} ${transaction.hash}`);
}

function as(contract: Contract, signer: typeof operator | Wallet): Contract {
  return contract.connect(signer) as Contract;
}

async function now(): Promise<bigint> {
  return BigInt((await ethers.provider.getBlock("latest"))?.timestamp ?? 0);
}

console.log(`Smoke test on ${networkName} (chain ${chainId})`);
console.log(`  operator ${operator.address}`);
console.log(`  borrower ${borrower.address} (ephemeral)`);

const poolAddress = await LendingPool.getAddress();
const funding = parseEther(process.env.SMOKE_BORROWER_FUNDING_ETH ?? (isLocal ? "1" : "0.01"));
await (await operator.sendTransaction({ to: borrower.address, value: funding })).wait();

console.log("Lender flow");
await record("MockUSDC.mint (operator liquidity)", as(MockUSDC, operator).mint(operator.address, usdc(2_000)));
await record("MockUSDC.approve (lender -> pool)", as(MockUSDC, operator).approve(poolAddress, usdc(1_000)));
await record("LendingPool.deposit 1,000", as(LendingPool, operator).deposit(usdc(1_000), operator.address));

console.log("Borrower flow");
const assessmentId = uuidToBytes32(crypto.randomUUID());
await record("MockUSDC.faucet (borrower)", as(MockUSDC, borrower).faucet());
await record("IdentityRegistry.register", as(IdentityRegistry, borrower).register(hashText(borrower.address)));
await record(
  "CreditScoreRegistry.attest 71.00",
  as(CreditScoreRegistry, operator).attest(borrower.address, assessmentId, 7100, (await now()) + 30n * DAY, 1),
);
await record("LoanManager.requestLoan 100 / 30d", as(LoanManager, borrower).requestLoan(usdc(100), 30));
const loanId = (await LoanManager.openLoanOf(borrower.address)) as bigint;
const loan = await LoanManager.getLoan(loanId);
if (loan.status !== 2n) {
  throw new Error(`Loan ${loanId} was not funded (status ${loan.status}).`);
}
await record("MockUSDC.approve (borrower -> pool)", as(MockUSDC, borrower).approve(poolAddress, usdc(1_000)));
await record("LoanManager.repay partial 50", as(LoanManager, borrower).repay(loanId, usdc(50)));
await record("LoanManager.repayInFull", as(LoanManager, borrower).repayInFull(loanId));

console.log("Dispute flow");
await record("DisputeManager.openDispute", as(DisputeManager, borrower).openDispute(assessmentId, hashText("smoke dispute")));
const disputeId = ((await DisputeManager.nextDisputeId()) as bigint) - 1n;
await record(
  "DisputeManager.resolveDispute (rejected)",
  as(DisputeManager, operator).resolveDispute(disputeId, false, hashText("smoke resolution")),
);

if (isLocal) {
  console.log("Overdue and recovery flow (local time travel)");
  await record("LoanManager.requestLoan 200 / 60d", as(LoanManager, borrower).requestLoan(usdc(200), 60));
  const overdueLoanId = (await LoanManager.openLoanOf(borrower.address)) as bigint;
  await ethers.provider.send("evm_increaseTime", [Number(35n * DAY)]);
  await ethers.provider.send("evm_mine", []);
  await record("LoanManager.markOverdue", as(LoanManager, operator).markOverdue(overdueLoanId));
  const outstanding = (await LoanManager.outstanding(overdueLoanId)) as bigint;
  const start = await now();
  await record(
    "RecoveryManager.submitRequest",
    as(RecoveryManager, borrower).submitRequest(overdueLoanId, outstanding, start + 60n * DAY, hashText("smoke recovery")),
  );
  const requestId = (await RecoveryManager.openRequestOf(overdueLoanId)) as bigint;
  await record(
    "RecoveryManager.approveRequest",
    as(RecoveryManager, operator).approveRequest(requestId, [outstanding], [start + 60n * DAY], hashText("smoke plan")),
  );
  await record("MockUSDC.faucet (borrower top-up)", as(MockUSDC, borrower).faucet());
  await record("LoanManager.repayInFull (restructured)", as(LoanManager, borrower).repayInFull(overdueLoanId));
  await record("RecoveryManager.completeMilestone", as(RecoveryManager, operator).completeMilestone(requestId, 0));
} else {
  console.log("Overdue and recovery flow: not applicable on a public testnet (requires time travel); covered by local tests.");
}

console.log("Lender exit");
await record("LendingPool.withdraw 500", as(LendingPool, operator).withdraw(usdc(500), operator.address, operator.address));

const idle = (await LendingPool.totalIdle()) as bigint;
const balance = (await MockUSDC.balanceOf(poolAddress)) as bigint;
if (balance < idle) {
  throw new Error(`Pool balance ${balance} is below accounted idle cash ${idle}.`);
}
console.log(`Reconciliation: pool balance ${balance} >= idle ${idle}`);

const output = path.join(DEPLOYMENTS_DIR, `${networkName}-smoke.json`);
await writeFile(
  output,
  `${JSON.stringify({ network: networkName, chainId: Number(chainId), ranAt: new Date().toISOString(), evidence }, null, 2)}\n`,
);
console.log(`${evidence.length} confirmed transactions. Evidence written to ${output}`);
