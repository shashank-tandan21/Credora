import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { HardhatEthers, HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import { type Contract, id, keccak256, parseUnits, toUtf8Bytes, ZeroHash, zeroPadValue } from "ethers";

export const CONTRACTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO_ROOT = path.resolve(CONTRACTS_ROOT, "..");
export const DEPLOYMENTS_DIR = path.join(CONTRACTS_ROOT, "deployments");

export const USDC_DECIMALS = 6;
export const DAY = 24n * 60n * 60n;
export const LOCAL_CHAIN_ID = 31337n;
export const SEPOLIA_CHAIN_ID = 11155111n;

/** Contract names in deployment order. Order matters for deterministic local addresses. */
export const CONTRACT_NAMES = [
  "MockUSDC",
  "IdentityRegistry",
  "CreditScoreRegistry",
  "LendingPool",
  "LoanManager",
  "RecoveryManager",
  "DisputeManager",
] as const;
export type ContractName = (typeof CONTRACT_NAMES)[number];

export const ROLES = {
  DEFAULT_ADMIN: ZeroHash,
  MINTER: id("MINTER_ROLE"),
  PAUSER: id("PAUSER_ROLE"),
  REGISTRAR: id("REGISTRAR_ROLE"),
  ATTESTER: id("ATTESTER_ROLE"),
  DISPUTE_MANAGER: id("DISPUTE_MANAGER_ROLE"),
  LOAN_MANAGER: id("LOAN_MANAGER_ROLE"),
  FUNDER: id("FUNDER_ROLE"),
  RECOVERY_MANAGER: id("RECOVERY_MANAGER_ROLE"),
  RECOVERY_OFFICER: id("RECOVERY_OFFICER_ROLE"),
  REVIEWER: id("REVIEWER_ROLE"),
} as const;

/** Mirrors ILoanManager.LoanStatus. */
export const LoanStatus = {
  None: 0n,
  Requested: 1n,
  Active: 2n,
  Overdue: 3n,
  Restructured: 4n,
  Repaid: 5n,
  Cancelled: 6n,
  Defaulted: 7n,
} as const;

export interface LoanParameters {
  annualRateBps: number;
  gracePeriod: bigint;
  requestTtl: bigint;
  defaultAfter: bigint;
  autoFund: boolean;
  limitPerScoreBps: bigint;
  minPrincipal: bigint;
  maxPrincipal: bigint;
}

export function usdc(value: string | number): bigint {
  return parseUnits(String(value), USDC_DECIMALS);
}

/**
 * Default risk parameters, aligned with the backend demo quote engine:
 * 12% APR, limit = score x 15 MockUSDC capped at 2,000.
 * A backend score of 71.00 is 7,100 bps -> 7,100 x 150,000 = 1,065 MockUSDC.
 */
export const DEFAULT_LOAN_PARAMETERS: LoanParameters = {
  annualRateBps: 1200,
  gracePeriod: 3n * DAY,
  requestTtl: 7n * DAY,
  defaultAfter: 60n * DAY,
  autoFund: true,
  limitPerScoreBps: 150_000n,
  minPrincipal: usdc(1),
  maxPrincipal: usdc(2000),
};

/** Encode a backend UUID (assessment or profile id) as bytes32, left-padded. */
export function uuidToBytes32(uuid: string): string {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error(`Not a UUID: ${uuid}`);
  }
  return zeroPadValue(`0x${hex}`, 32);
}

/** keccak256 of UTF-8 text; used for profile, reason, and resolution note hashes. */
export function hashText(text: string): string {
  return keccak256(toUtf8Bytes(text));
}

export interface DeploymentRecord {
  address: string;
  transactionHash: string;
  blockNumber: number;
  /** JSON-safe constructor arguments (bigints as decimal strings) for source verification. */
  constructorArgs: unknown[];
}

/** ILoanManager.LoanParameters as an ordered tuple, the form ABI encoders and verifiers expect. */
export function loanParametersTuple(p: LoanParameters): unknown[] {
  return [p.annualRateBps, p.gracePeriod, p.requestTtl, p.defaultAfter, p.autoFund, p.limitPerScoreBps, p.minPrincipal, p.maxPrincipal];
}

function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  return value;
}

export interface ProtocolContracts {
  mockUsdc: Contract;
  identityRegistry: Contract;
  creditScoreRegistry: Contract;
  lendingPool: Contract;
  loanManager: Contract;
  recoveryManager: Contract;
  disputeManager: Contract;
}

export interface DeployedProtocol extends ProtocolContracts {
  records: Record<ContractName, DeploymentRecord>;
  operator: string;
  loanParameters: LoanParameters;
}

export interface DeployOptions {
  admin: HardhatEthersSigner;
  /** Receives REGISTRAR, ATTESTER, FUNDER, RECOVERY_OFFICER and REVIEWER roles. Defaults to admin. */
  operator?: string;
  loanParameters?: LoanParameters;
  faucetEnabled?: boolean;
  log?: (message: string) => void;
}

/** Deploy all seven contracts and wire every protocol role. Used by tests and scripts. */
export async function deployProtocol(ethers: HardhatEthers, options: DeployOptions): Promise<DeployedProtocol> {
  const { admin } = options;
  const operator = options.operator ?? admin.address;
  const loanParameters = options.loanParameters ?? DEFAULT_LOAN_PARAMETERS;
  const log = options.log ?? (() => {});
  const records = {} as Record<ContractName, DeploymentRecord>;

  async function deploy(name: ContractName, args: unknown[]): Promise<Contract> {
    const contract = (await ethers.deployContract(name, args, admin)) as unknown as Contract;
    await contract.waitForDeployment();
    const transaction = contract.deploymentTransaction();
    if (transaction === null) {
      throw new Error(`${name} has no deployment transaction`);
    }
    const receipt = await transaction.wait();
    if (receipt === null || receipt.status !== 1) {
      throw new Error(`${name} deployment failed`);
    }
    const address = await contract.getAddress();
    records[name] = {
      address,
      transactionHash: transaction.hash,
      blockNumber: receipt.blockNumber,
      constructorArgs: args.map(toJsonSafe),
    };
    log(`  ${name.padEnd(20)} ${address}  (tx ${transaction.hash})`);
    return contract;
  }

  async function grant(contract: Contract, role: string, account: string, label: string): Promise<void> {
    if (await contract.hasRole(role, account)) {
      return;
    }
    const transaction = await contract.connect(admin).getFunction("grantRole")(role, account);
    await transaction.wait();
    log(`  granted ${label.padEnd(22)} -> ${account}`);
  }

  log("Deploying contracts");
  const mockUsdc = await deploy("MockUSDC", [admin.address, options.faucetEnabled ?? true]);
  const identityRegistry = await deploy("IdentityRegistry", [admin.address]);
  const creditScoreRegistry = await deploy("CreditScoreRegistry", [admin.address, await identityRegistry.getAddress()]);
  const lendingPool = await deploy("LendingPool", [await mockUsdc.getAddress(), admin.address]);
  const loanManager = await deploy("LoanManager", [
    admin.address,
    await lendingPool.getAddress(),
    await creditScoreRegistry.getAddress(),
    await identityRegistry.getAddress(),
    loanParametersTuple(loanParameters),
  ]);
  const recoveryManager = await deploy("RecoveryManager", [admin.address, await loanManager.getAddress()]);
  const disputeManager = await deploy("DisputeManager", [admin.address, await creditScoreRegistry.getAddress()]);

  log("Wiring protocol roles");
  await grant(lendingPool, ROLES.LOAN_MANAGER, await loanManager.getAddress(), "LOAN_MANAGER_ROLE");
  await grant(loanManager, ROLES.RECOVERY_MANAGER, await recoveryManager.getAddress(), "RECOVERY_MANAGER_ROLE");
  await grant(creditScoreRegistry, ROLES.DISPUTE_MANAGER, await disputeManager.getAddress(), "DISPUTE_MANAGER_ROLE");

  log("Granting operator roles");
  await grant(identityRegistry, ROLES.REGISTRAR, operator, "REGISTRAR_ROLE");
  await grant(creditScoreRegistry, ROLES.ATTESTER, operator, "ATTESTER_ROLE");
  await grant(loanManager, ROLES.FUNDER, operator, "FUNDER_ROLE");
  await grant(recoveryManager, ROLES.RECOVERY_OFFICER, operator, "RECOVERY_OFFICER_ROLE");
  await grant(disputeManager, ROLES.REVIEWER, operator, "REVIEWER_ROLE");

  return {
    mockUsdc,
    identityRegistry,
    creditScoreRegistry,
    lendingPool,
    loanManager,
    recoveryManager,
    disputeManager,
    records,
    operator,
    loanParameters,
  };
}

export interface SeedOptions {
  admin: HardhatEthersSigner;
  recipients: string[];
  mintPerAccount?: bigint;
  poolLiquidity?: bigint;
  log?: (message: string) => void;
}

/** Local-only seeding: mint MockUSDC to test accounts and supply initial pool liquidity. */
export async function seedLocalLiquidity(protocol: ProtocolContracts, options: SeedOptions): Promise<void> {
  const { admin, mockUsdc, lendingPool } = { ...options, ...protocol };
  const mintPerAccount = options.mintPerAccount ?? usdc(100_000);
  const poolLiquidity = options.poolLiquidity ?? usdc(25_000);
  const log = options.log ?? (() => {});

  for (const recipient of options.recipients) {
    await (await mockUsdc.connect(admin).getFunction("mint")(recipient, mintPerAccount)).wait();
  }
  log(`  minted ${mintPerAccount / 10n ** 6n} mUSDC to ${options.recipients.length} accounts`);

  await (await mockUsdc.connect(admin).getFunction("approve")(await lendingPool.getAddress(), poolLiquidity)).wait();
  await (await lendingPool.connect(admin).getFunction("deposit")(poolLiquidity, admin.address)).wait();
  log(`  supplied ${poolLiquidity / 10n ** 6n} mUSDC seed liquidity to LendingPool`);
}

export interface DeploymentManifest {
  network: string;
  chainId: number;
  deployedAt: string;
  deployer: string;
  operator: string;
  seeded: boolean;
  loanParameters: Record<string, string | number | boolean>;
  contracts: Record<ContractName, DeploymentRecord>;
}

export function buildManifest(
  network: string,
  chainId: bigint,
  deployer: string,
  protocol: DeployedProtocol,
  seeded: boolean,
): DeploymentManifest {
  const loanParameters = Object.fromEntries(
    Object.entries(protocol.loanParameters).map(([key, value]) => [
      key,
      typeof value === "bigint" ? value.toString() : value,
    ]),
  );
  return {
    network,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    deployer,
    operator: protocol.operator,
    seeded,
    loanParameters,
    contracts: protocol.records,
  };
}

/** Per-network files keep local and Sepolia addresses strictly separate. */
export async function writeManifest(manifest: DeploymentManifest): Promise<string> {
  await mkdir(DEPLOYMENTS_DIR, { recursive: true });
  const file = path.join(DEPLOYMENTS_DIR, `${manifest.network}.json`);
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);

  const envFile = path.join(DEPLOYMENTS_DIR, `${manifest.network}.env.example`);
  const lines = [
    `# Generated by contracts/scripts/deploy.ts for ${manifest.network} (chain ${manifest.chainId}).`,
    "# Public addresses only (no secrets). Copy into backend/.env and frontend/.env.local as needed.",
    `CHAIN_ID=${manifest.chainId}`,
    `VITE_CHAIN_ID=${manifest.chainId}`,
  ];
  for (const name of CONTRACT_NAMES) {
    const key = name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
    lines.push(`${key}_ADDRESS=${manifest.contracts[name].address}`);
    lines.push(`VITE_${key}_ADDRESS=${manifest.contracts[name].address}`);
  }
  await writeFile(envFile, `${lines.join("\n")}\n`);
  return file;
}
