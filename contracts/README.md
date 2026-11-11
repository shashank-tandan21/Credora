# REBOUND / Credora Contracts

Solidity contracts, deployment scripts, and tests for the REBOUND academic micro-lending
prototype. Owner: **B — Blockchain/Web3**.

> Academic prototype. Contracts are unaudited, use a valueless test token (`MockUSDC`),
> and must never be deployed to mainnet. The deploy script refuses any chain other than
> Hardhat (31337) and Sepolia (11155111).

## Stack

| Item | Version |
|---|---|
| Hardhat | 3.21.2 (mocha + ethers v6 plugins, keystore, verify) |
| Solidity | 0.8.28, optimizer 200 runs, EVM `cancun` |
| OpenZeppelin Contracts | 5.6.1 (AccessControl, Pausable, ReentrancyGuard, SafeERC20, ERC-4626) |
| Node.js | 22.10 or newer |

All dependency versions are pinned exactly in `package.json` and locked in `package-lock.json`.
Contracts are **non-upgradeable**; a fix ships as a new deployment with a new manifest.

## Commands

```powershell
cd contracts
npm ci
npm run compile          # compile all contracts
npm test                 # unit + integration tests (97 tests)
npm run coverage         # tests with line/statement coverage
npm run typecheck        # TypeScript check of config, scripts, and tests
```

### Local deployment (Phase 10)

```powershell
# Terminal 1: fresh local chain (chain id 31337)
npm run node

# Terminal 2: deploy, seed, export ABIs/addresses, and run the end-to-end smoke test
npm run deploy:local
npm run smoke:local
```

`deploy:local` deploys all seven contracts, wires roles, mints 100,000 mUSDC to Hardhat
accounts #0-#4, supplies 25,000 mUSDC of pool liquidity (matching the backend demo pool),
and writes:

| File | Contents |
|---|---|
| `deployments/localhost.json` | Addresses, deployment tx hashes, blocks, constructor args, loan parameters |
| `deployments/localhost.env.example` | Public addresses as backend/frontend environment variables |
| `deployments/abi/<Contract>.json` | ABI per contract |
| `deployments/abi/interface.json` | Every event topic and custom-error selector |
| `../frontend/src/web3/generated/abis.ts` | Typed `as const` ABIs for wagmi/viem |
| `../frontend/src/web3/generated/localDeployment.ts` | Local (31337) addresses only |
| `../backend/app/services/chain_events.py` | Event topics used for receipt verification |

On a fresh node the deployer is Hardhat account #0 and addresses are deterministic:

| Contract | Local address |
|---|---|
| MockUSDC | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| IdentityRegistry | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| CreditScoreRegistry | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| LendingPool | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |
| LoanManager | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` |
| RecoveryManager | `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707` |
| DisputeManager | `0x0165878A594ca255338adfa4d48449f69242Eb8F` |

Restarting the node wipes chain state; run `npm run deploy:local` again. If the node was
not fresh, addresses differ and `localhost.json` is rewritten. Run `npm run export`
afterwards so the frontend picks them up.

`smoke:local` runs 20 real transactions (deposit, register, attest, borrow, partial and
full repayment, dispute, overdue, restructuring, milestone, withdrawal), waits for each
receipt, and writes the evidence to `deployments/localhost-smoke.json` (git-ignored).
The CLI also prints each confirmed transaction's gas used, effective gas price in gwei,
and total fee in ETH. The browser on-chain flow prints the same details in the browser
developer console after MetaMask confirmation; Demo Mode logs that no blockchain gas fee
was used because its actions are simulated.

### Sepolia deployment (Phase 11)

Sepolia secrets are read through Hardhat configuration variables, from environment
variables or from the encrypted Hardhat keystore. Prefer the keystore:

```powershell
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_DEPLOYER_PRIVATE_KEY
npx hardhat keystore set ETHERSCAN_API_KEY

npm run deploy:sepolia    # runs the full test suite first; aborts on any failure
npm run smoke:sepolia     # end-to-end evidence with real receipts
npm run verify:sepolia    # Etherscan source verification from deployments/sepolia.json
```

`deploy:sepolia` refuses to send any transaction until `hardhat test` passes, and the
deploy script itself refuses Sepolia unless invoked through that gate. The smoke test uses
an ephemeral borrower wallet funded with 0.01 Sepolia ETH by the deployer
(`SMOKE_BORROWER_FUNDING_ETH` overrides it), so no second key is needed. The overdue and
recovery steps need time travel and are reported as not applicable on Sepolia.

Use a dedicated deployer holding only the testnet ETH it needs. Never paste a private key
into a file, commit, issue, or chat. Set `OPERATOR_ADDRESS` to give operational roles to a
different wallet than the deployer.

## Contracts

| Contract | Responsibility |
|---|---|
| `MockUSDC` | 6-decimal test ERC-20; `MINTER_ROLE` minting (max 1,000,000 per call) and a public faucet of 1,000 mUSDC per address per 24 h |
| `IdentityRegistry` | Borrower self-registration with a profile hash; registrars revoke/reinstate |
| `CreditScoreRegistry` | Expiring, versioned score attestations keyed by backend assessment UUID |
| `LendingPool` | ERC-4626 vault; lender shares (`cpUSDC`), idle liquidity, disbursement, repayment collection, losses |
| `LoanManager` | Request, fund/disburse, repay (partial/full), overdue, cure, restructure, cancel, default |
| `RecoveryManager` | Restructuring requests for overdue loans, officer-approved milestone plans, deterministic progress |
| `DisputeManager` | Borrower disputes of their own attestation; reviewer resolution with notes hash |

### Units and conventions

- Token amounts are `uint256` MockUSDC smallest units (6 decimals): `500 mUSDC = 500_000_000`.
- Scores are basis points: backend score `71.00` is attested as `7100`.
- Rates are basis points: 12% APR is `1200`.
- Interest is simple interest rounded **down** to one smallest unit:
  `principal * annualRateBps * durationDays / (10000 * 365)`. 500 mUSDC for 90 days accrues
  `14.794520` mUSDC. The backend rounds quotes to cents (`14.79`); on-chain amounts are
  authoritative for settlement, so "repay in full" reads the exact outstanding from chain.
- Installments: `ceil(durationDays / 30)`, installment *k* due at `fundedAt + 30 days * k`,
  each `floor(totalDue / count)`, the final one absorbing the remainder.
- Repayments settle outstanding interest first, then principal.
- Installment *k* is past due once `block.timestamp >= dueAt(k) + gracePeriod` (3 days).
  Late payment carries no penalty interest; it makes the loan `Overdue`, which anyone may
  record with `markOverdue`, and eligible for recovery.
- Eligible limit: `scoreBps * limitPerScoreBps` capped at `maxPrincipal`, which reproduces
  the backend's `min(score x 15, 2000)` (a score of 71 gives 1,065 mUSDC).
- Off-chain notes (profile, dispute reason, resolution, recovery reason) are referenced by
  `keccak256` hash only. No personal data is written on-chain.
- Backend UUIDs map to `bytes32` by left-padding the 16 UUID bytes (`uuidToBytes32`).

### Loan lifecycle

```text
requestLoan ──► Requested ──fundLoan / autoFund──► Active ──repay (all)──► Repaid
                   │                                 │  ▲
     cancelLoan /  │                     markOverdue │  │ repay clears arrears (LoanCured)
     expiry        ▼                                 ▼  │
               Cancelled                           Overdue ──markDefaulted──► Defaulted
                                                      │
                                    RecoveryManager   │ approveRequest
                                                      ▼
                                                 Restructured ──repay (all)──► Repaid
```

- `autoFund` (default on) funds and disburses in the request transaction when idle
  liquidity covers the principal; otherwise the loan stays `Requested` for a funder.
- A request expires after `requestTtl` (7 days). A funder cannot fund it afterwards and
  anyone may cancel it. Funding re-checks identity and score eligibility.
- One open loan per borrower (`OpenLoanExists`). This prevents duplicate requests and
  double-reserving liquidity.
- `markDefaulted` needs `Overdue` and `finalDueAt + defaultAfter` (60 days); unrepaid
  principal is recorded as a pool loss and lowers the share price.
- Repayments and cancellation are allowed while paused, so borrowers can always settle.

### Roles

| Contract | Role | Holder after `deployProtocol` | Grants |
|---|---|---|---|
| all | `DEFAULT_ADMIN_ROLE` | deployer | role administration, parameters, faucet switch, token recovery |
| all pausable | `PAUSER_ROLE` | deployer | `pause` / `unpause` |
| MockUSDC | `MINTER_ROLE` | deployer | `mint` |
| IdentityRegistry | `REGISTRAR_ROLE` | operator | `revoke`, `reinstate` |
| CreditScoreRegistry | `ATTESTER_ROLE` | operator | `attest`, `revoke` |
| CreditScoreRegistry | `DISPUTE_MANAGER_ROLE` | DisputeManager | `setDisputed`, `revokeDisputed` |
| LendingPool | `LOAN_MANAGER_ROLE` | LoanManager | `disburse`, `collectRepayment`, `recordLoss` |
| LoanManager | `FUNDER_ROLE` | operator | `fundLoan`, `markDefaulted`, cancel any request |
| LoanManager | `RECOVERY_MANAGER_ROLE` | RecoveryManager | `restructure` |
| RecoveryManager | `RECOVERY_OFFICER_ROLE` | operator | `approveRequest`, `rejectRequest` |
| DisputeManager | `REVIEWER_ROLE` | operator | `resolveDispute` |

Conflict-of-interest rules are enforced on-chain: an attester cannot attest their own
wallet (`SelfAttestation`), a reviewer cannot resolve a dispute they opened
(`ReviewerConflict`), and an officer cannot decide on their own recovery request
(`OfficerConflict`). Any reviewer may resolve any other open dispute, which is the
on-chain reassignment rule. In a real deployment the admin would be a multisig.

### Pause and emergency behaviour

| Paused contract | Blocked | Still allowed |
|---|---|---|
| IdentityRegistry | `register`, `updateProfile` | revoke, reinstate, reads |
| CreditScoreRegistry | `attest` | revoke, dispute hooks, reads |
| LendingPool | deposit, mint, withdraw, redeem, disburse | `collectRepayment`, `recordLoss` |
| LoanManager | `requestLoan`, `fundLoan` | repay, cancel, markOverdue, markDefaulted, restructure |
| RecoveryManager | `submitRequest`, `approveRequest` | cancel, reject, completeMilestone |
| DisputeManager | `openDispute`, `resolveDispute` | `withdrawDispute` |

`LendingPool.recoverTokens` lets the admin recover tokens sent by mistake. For the pool
asset only the surplus above accounted idle cash can be recovered, so lender funds can
never be swept. `totalAssets()` uses internal accounting (`totalIdle + totalBorrowed`), so
direct token donations cannot manipulate the share price.

## Events for backend synchronization

Every state change emits an event with stable ids, wallet addresses, amounts, and a
`timestamp`. Topics for all events are exported to `deployments/abi/interface.json` and
`backend/app/services/chain_events.py`.

| Contract | Event | Indexed | Data |
|---|---|---|---|
| IdentityRegistry | `IdentityRegistered` | wallet, profileHash | timestamp |
| IdentityRegistry | `IdentityProfileUpdated` | wallet, profileHash | timestamp |
| IdentityRegistry | `IdentityRevoked` / `IdentityReinstated` | wallet, registrar | reasonHash, timestamp |
| CreditScoreRegistry | `ScoreAttested` | borrower, assessmentId, attester | scoreBps, version, modelVersion, expiresAt, timestamp |
| CreditScoreRegistry | `ScoreRevoked` | borrower, assessmentId, revokedBy | reasonHash, timestamp |
| CreditScoreRegistry | `ScoreDisputeFlagged` | assessmentId | disputed, timestamp |
| LendingPool | `Deposit` / `Withdraw` (ERC-4626) | sender, owner (+receiver) | assets, shares |
| LendingPool | `LoanDisbursed` | loanId, borrower | principal, timestamp |
| LendingPool | `RepaymentCollected` | loanId, payer | principal, interest, timestamp |
| LendingPool | `LossRecorded` | loanId | principalLoss, timestamp |
| LoanManager | `LoanRequested` | loanId, borrower, assessmentId | principal, interest, durationDays, installmentCount, timestamp |
| LoanManager | `LoanFunded` | loanId, borrower, fundedBy | principal, finalDueAt, timestamp |
| LoanManager | `RepaymentMade` | loanId, borrower, payer | amount, principalPortion, interestPortion, outstanding, timestamp |
| LoanManager | `LoanRepaid` | loanId, borrower | totalRepaid, timestamp |
| LoanManager | `LoanOverdue` / `LoanCured` | loanId, borrower | amountPastDue, timestamp |
| LoanManager | `LoanRestructured` | loanId, borrower | previousOutstanding, newOutstanding, newFinalDueAt, timestamp |
| LoanManager | `LoanCancelled` / `LoanDefaulted` | loanId, borrower | principalLoss, timestamp |
| RecoveryManager | `RecoveryRequested` / `RecoveryApproved` / `RecoveryRejected` / `RecoveryCancelled` / `RecoveryCompleted` | requestId, loanId, borrower/officer | amounts, hashes, timestamp |
| RecoveryManager | `MilestoneScheduled` / `MilestoneCompleted` | requestId, index | amount, dueAt / cumulativePaid |
| DisputeManager | `DisputeOpened` / `DisputeWithdrawn` / `DisputeResolved` | disputeId, assessmentId, borrower/reviewer | outcome, reasonHash/resolutionHash, timestamp |

`LendingPool` idle cash is fully reconcilable from events:
`sum(Deposit.assets) - sum(Withdraw.assets) - sum(LoanDisbursed.principal) + sum(RepaymentCollected.principal + interest) == totalIdle`.
The integration suite asserts this identity.

Synchronization rules for consumers: treat a transaction as `confirmed` only after a
successful receipt on the expected chain from the expected contract; key idempotent
writes by transaction hash and log index; and on a chain reorganization, re-read state
for affected blocks rather than trusting cached events.

## Custom errors

| Contract | Errors |
|---|---|
| MockUSDC | `ZeroAddress`, `FaucetDisabled`, `FaucetCooldownActive(availableAt)`, `MintAmountInvalid(amount)` |
| IdentityRegistry | `ZeroAddress`, `InvalidProfileHash`, `AlreadyRegistered(wallet)`, `NotRegistered(wallet)`, `IdentityIsRevoked(wallet)`, `IdentityNotRevoked(wallet)` |
| CreditScoreRegistry | `ZeroAddress`, `InvalidAssessmentId`, `AttestationExists(id)`, `AttestationNotFound(id)`, `AttestationNotActive(id)`, `ScoreOutOfRange(scoreBps)`, `InvalidExpiry(expiresAt)`, `IdentityNotRegistered(borrower)`, `SelfAttestation(attester)` |
| LendingPool | `ZeroAddress`, `ZeroAmount`, `InsufficientLiquidity(requested, available)`, `PrincipalExceedsBorrowed(principal, borrowed)`, `RecoveryExceedsSurplus(requested, surplus)` |
| LoanManager | `ZeroAddress`, `ZeroAmount`, `InvalidParameters`, `LoanNotFound(id)`, `IdentityNotRegistered(borrower)`, `NoValidCreditScore(borrower)`, `OpenLoanExists(borrower, id)`, `InvalidDuration(days)`, `PrincipalOutOfRange(principal, min, max)`, `ExceedsEligibleLimit(principal, limit)`, `InvalidLoanStatus(id, status)`, `RequestExpired(id, expiredAt)`, `NotAuthorizedToCancel(id, caller)`, `RepaymentExceedsOutstanding(amount, outstanding)`, `LoanNotOverdue(id)`, `DefaultNotReached(id, eligibleAt)`, `RestructureUnderpays(proposed, current)`, `InvalidDueDate(dueAt)` |
| RecoveryManager | `ZeroAddress`, `InvalidReasonHash`, `RequestNotFound(id)`, `NotLoanBorrower(loanId, caller)`, `LoanNotEligible(loanId)`, `RequestAlreadyOpen(loanId, requestId)`, `ProposalUnderpays(proposed, current)`, `InvalidDueDate(dueAt)`, `InvalidRequestStatus(id, status)`, `InvalidMilestones`, `OfficerConflict(officer)`, `MilestoneOutOfOrder(expected, provided)`, `MilestoneNotFunded(required, paid)` |
| DisputeManager | `ZeroAddress`, `InvalidReasonHash`, `InvalidResolutionHash`, `DisputeNotFound(id)`, `NotAttestationOwner(id, caller)`, `AttestationNotActive(id)`, `DisputeAlreadyOpen(id, disputeId)`, `DisputeNotOpen(id, status)`, `NotDisputeBorrower(id, caller)`, `ReviewerConflict(reviewer)` |

OpenZeppelin errors also surface: `AccessControlUnauthorizedAccount(account, role)`,
`EnforcedPause`, `ReentrancyGuardReentrantCall`, and the ERC-20/ERC-4626 errors.

## Tests and coverage

97 tests across unit suites per contract, input validation, reentrancy (a malicious token
re-enters the pool during disbursement and repayment collection), and an integration
suite that deploys through the same `deployProtocol` used by the deploy script.

| Contract | Line coverage |
|---|---:|
| DisputeManager | 100% |
| LendingPool | 100% |
| MockUSDC | 100% |
| CreditScoreRegistry | 98.2% |
| LoanManager | 97.6% |
| RecoveryManager | 97.2% |
| IdentityRegistry | 94.3% |
| **Total** | **97.6%** |

Coverage threshold for this package: **95% of lines**. The remaining uncovered lines are
constructor zero-address branches for secondary arguments and defensive paths that the
current state machine cannot reach.

## Threat assumptions and limitations

- Wallet compromise: a compromised operator can attest arbitrary scores and fund loans up to
  pool liquidity; a compromised admin controls every role. Roles are separable via
  `OPERATOR_ADDRESS`, and pausing stops new exposure.
- Malicious evidence: the chain only stores what an attester signs; evidence quality is an
  off-chain responsibility.
- Duplicate callbacks and replays: each state transition checks the current status, so a
  repeated transaction reverts instead of applying twice.
- RPC failure or wrong chain: consumers must check chain id and receipt status before
  marking anything confirmed (see the frontend transaction lifecycle).
- Not covered: audits, formal verification, upgradeability, oracle-based score feeds,
  real KYC, mainnet deployment, and real funds.
