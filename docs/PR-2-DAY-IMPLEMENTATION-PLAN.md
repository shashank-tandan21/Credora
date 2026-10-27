# REBOUND — Two-Day PR Implementation Plan

## Purpose

This document is the single execution sequence for the REBOUND academic
prototype. It records completed work and the remaining work so future sessions
continue from the correct point instead of repeating completed tasks.

The project is a demo-first blockchain micro-lending prototype. It must clearly
distinguish demo behavior from confirmed Ethereum Sepolia transactions.

## Status legend

- `[x]` Completed and should not be repeated
- `[ ]` Planned
- `[~]` In progress
- `Demo` In-memory or simulated behavior
- `Sepolia` Real testnet behavior after deployment and confirmation

## Current starting point

The backend foundation and first domain workflows are implemented in
[`backend/`](../backend/). The frontend, Solidity contracts, PostgreSQL
migrations, and real Sepolia integration are still pending.

The project currently has no deployed contract addresses and should continue to
run in `DEMO_MODE=true` until the contract and network integration gates are
passed.

---

# Three-member ownership plan

The work is divided across three members by workstream. Each member owns
implementation, tests, documentation updates, and handoff for their assigned
areas. The assignments are intentionally dependency-aware: parallel work is
allowed where interfaces are already defined, while integration gates remain
shared.

| Member | Primary ownership | Supporting ownership |
|---|---|---|
| **A — Backend and data** | FastAPI, PostgreSQL, repositories, repayments, recovery, disputes, API tests | Backend/manual documentation and frontend API contract support |
| **B — Blockchain and Web3** | Solidity contracts, Hardhat, OpenZeppelin, local deployment, Sepolia, Wagmi/Viem transaction states | Contract ABI/address handoff and blockchain integration tests |
| **C — Frontend and quality** | React UI, responsive pages, charts, forms, frontend API integration, UX states | End-to-end QA, manual test coordination, accessibility/responsive verification |

## Equal remaining-work allocation

The remaining twelve phases are allocated as four phases per member. The
allocation balances implementation effort rather than simply counting files:

| Member | Assigned phases | Delivery responsibility |
|---|---|---|
| **A** | 1, 2, 3, 4 | Persistent backend and all remaining backend domain workflows |
| **B** | 5, 9, 10, 11 | Contracts, wallet transactions, local deployment, and Sepolia |
| **C** | 6, 7, 8, 12 | Frontend product, API consumption, UX states, and final QA |

Phase 12 is owned by C but cannot close until A signs off the backend and B signs
off the contract/network flows. Likewise, C may work against demo endpoints
while A and B implement their assigned production paths.

## Completed work ownership — already done

These items are historical records and must not be reimplemented:

| Completed area | Owner | Status |
|---|---|---|
| FastAPI foundation, settings, routing, health checks | A | `[x]` |
| Demo wallet nonce flow and protected API dependency | A | `[x]` |
| User, borrower, credit, loan, and pool backend models | A | `[x]` |
| Borrower registration and profile API | A | `[x]` |
| Explainable credit scoring and evidence API | A | `[x]` |
| Loan quote, request, repayment schedule, and pool statistics demo API | A | `[x]` |
| Backend automated tests and manual API guide | A + C | `[x]` |
| Overall architecture and Web3 integration boundaries | B + A | `[x]` |

## Ownership rules

- The owner may implement directly or coordinate a focused contribution from
  another member, but remains responsible for acceptance criteria.
- A owns backend API contracts; B owns contract interfaces and transaction
  semantics; C consumes both through typed clients.
- C may begin UI work against the existing demo endpoints while A and B finish
  production integrations.
- B must not deploy to Sepolia until local contract tests pass.
- A and B must expose explicit transaction states; C must display those states
  without converting pending or failed actions into success.
- Every member updates this document and the relevant manual testing section
  when their task changes an API, contract, environment variable, or user flow.

---

# Completed work — do not repeat

## Architecture and foundation

- [x] Defined the modular architecture for frontend, FastAPI backend,
  PostgreSQL, Solidity, Hardhat, OpenZeppelin, Wagmi, Viem, and Sepolia.
- [x] Created the FastAPI backend package structure.
- [x] Added environment-based settings and `.env.example`.
- [x] Added API versioning under `/api/v1`.
- [x] Added root and versioned health endpoints.
- [x] Added async SQLAlchemy engine and session factory.
- [x] Added backend setup instructions in
  [`backend/README.md`](../backend/README.md).

## Demo authentication

- [x] Added wallet nonce generation.
- [x] Added one-time nonce validation and expiry checks.
- [x] Added explicit demo signature validation using `demo:<nonce>`.
- [x] Added bearer authentication dependency for protected routes.
- [x] Bound demo tokens to their issuing wallet.
- [x] Documented that demo authentication is not Ethereum signature verification.

## User and borrower workflow

- [x] Added `User` SQLAlchemy model.
- [x] Added `BorrowerProfile` SQLAlchemy model.
- [x] Added borrower registration endpoint:
  `POST /api/v1/borrowers/register`.
- [x] Added borrower profile endpoint:
  `GET /api/v1/borrowers/me`.
- [x] Added duplicate-registration handling.
- [x] Preserved `pending` identity status until IdentityRegistry integration.
- [x] Avoided reporting a fake blockchain transaction hash.

## Credit scoring workflow

- [x] Added financial evidence model and schemas.
- [x] Added credit assessment model and schemas.
- [x] Added evidence endpoint:
  `POST /api/v1/credit/evidence`.
- [x] Added evidence listing endpoint:
  `GET /api/v1/credit/evidence`.
- [x] Added assessment endpoint:
  `POST /api/v1/credit/assess`.
- [x] Added current assessment endpoint:
  `GET /api/v1/credit/current`.
- [x] Added assessment history endpoint:
  `GET /api/v1/credit/history`.
- [x] Implemented the requested weights:
  - Repayment history: 35%
  - Affordability: 25%
  - Cash-flow stability: 15%
  - Debt burden: 15%
  - Evidence quality: 10%
- [x] Added score categories from High risk through Strong.
- [x] Added weighted component contributions and explanations.
- [x] Added explicit academic-model disclosure.

## Loan and lending-pool demo workflow

- [x] Added loan and lender-position SQLAlchemy models.
- [x] Added loan quote endpoint:
  `POST /api/v1/loans/quote`.
- [x] Added loan request endpoint:
  `POST /api/v1/loans`.
- [x] Added borrower loan listing endpoint:
  `GET /api/v1/loans`.
- [x] Added pool statistics endpoint:
  `GET /api/v1/pool/statistics`.
- [x] Added score-based eligibility limit:
  `score × 15`, capped at `2,000 MockUSDC`.
- [x] Added 12% annual demo interest calculation.
- [x] Added installment schedule generation.
- [x] Added explicit `requested` loan status.
- [x] Added demo liquidity reservation.

## Validation and manual testing

- [x] Added backend tests for health and authentication.
- [x] Added borrower registration and authorization tests.
- [x] Added credit scoring and assessment history tests.
- [x] Added loan quotation and pool statistics tests.
- [x] Verified the complete suite at the current stage:
  `12 tests passed`.
- [x] Added repeatable PowerShell instructions in
  [`manual-testing.md`](./manual-testing.md).
- [x] Documented current demo limitations.

---

# Two-day execution sequence

## Day 1 — Persistence, remaining backend workflows, and contracts

### Phase 1 — PostgreSQL persistence — **Owner: A**

**Goal:** Replace in-memory storage with PostgreSQL while retaining demo mode.

- [ ] Add Alembic configuration and migration environment.
- [ ] Create the initial migration for:
  - `users`
  - `borrower_profiles`
  - `financial_evidence`
  - `credit_assessments`
  - `loans`
  - `lender_positions`
- [ ] Add repository interfaces for users, borrowers, evidence, assessments,
  loans, and pool positions.
- [ ] Implement PostgreSQL repositories.
- [ ] Keep the existing demo repositories selected by `DEMO_MODE=true`.
- [ ] Add startup configuration validation for production mode.
- [ ] Add database health reporting without making demo mode depend on a live
  database.

**Acceptance criteria:**

- A fresh PostgreSQL database can be migrated from zero.
- Demo mode still runs without PostgreSQL.
- Production mode fails explicitly when database configuration is missing.
- Existing API response shapes remain compatible.

### Phase 2 — Repayment workflow — **Owner: A**

**Goal:** Support repayment preparation and repayment history before blockchain
writes are added.

- [ ] Add `Repayment` model and schema.
- [ ] Add repayment schedule persistence.
- [ ] Add repayment quote endpoint.
- [ ] Add repayment preparation endpoint.
- [ ] Add repayment history endpoint.
- [ ] Add due-date and overdue calculations.
- [ ] Add transaction lifecycle fields:
  `prepared`, `submitted`, `pending`, `confirmed`, `failed`.
- [ ] Keep demo repayments clearly marked as demo actions.

**Acceptance criteria:**

- Repayment amounts match the loan schedule.
- Overdue status is derived from dates, not manually guessed.
- No repayment is marked confirmed without confirmation evidence.

### Phase 3 — Recovery and restructuring — **Owner: A**

**Goal:** Implement the recovery-aware differentiator of REBOUND.

- [ ] Add `RecoveryRequest` model and schema.
- [ ] Add recovery milestone model and schema.
- [ ] Add endpoint to list overdue loans.
- [ ] Add restructuring request endpoint.
- [ ] Add proposed repayment schedule validation.
- [ ] Add milestone creation and completion endpoints.
- [ ] Add recovery progress calculation.
- [ ] Add recovery assessment history linkage.

**Acceptance criteria:**

- Only eligible overdue loans can create recovery requests.
- Proposed schedules are validated against the outstanding amount.
- Milestone progress is deterministic and visible in the API.
- Recovery actions do not claim blockchain confirmation.

### Phase 4 — Disputes and reviewer APIs — **Owner: A**

**Goal:** Complete the assessment review workflow.

- [ ] Add `Dispute` model and schema.
- [ ] Add dispute submission endpoint.
- [ ] Add reviewer queue endpoints.
- [ ] Add dispute resolution endpoint.
- [ ] Add role checks for reviewer/admin actions.
- [ ] Add audit records for score and dispute decisions.

**Acceptance criteria:**

- Borrowers can submit disputes for their own assessments only.
- Reviewers can see pending disputes.
- Non-reviewers receive an explicit authorization error.
- Resolution state and notes are persisted.

### Phase 5 — Solidity project foundation — **Owner: B**

**Goal:** Create tested contract boundaries before any Sepolia deployment.

- [ ] Create Hardhat project configuration.
- [ ] Add OpenZeppelin dependencies.
- [ ] Add `MockUSDC.sol`.
- [ ] Add `IdentityRegistry.sol`.
- [ ] Add `CreditScoreRegistry.sol`.
- [ ] Add `LendingPool.sol`.
- [ ] Add `LoanManager.sol`.
- [ ] Add `RecoveryManager.sol`.
- [ ] Add `DisputeManager.sol`.
- [ ] Add access control and event definitions.
- [ ] Add unit tests for authorization, state transitions, and invalid inputs.

**Acceptance criteria:**

- Contracts compile successfully.
- Contract tests cover successful and rejected state transitions.
- Events expose enough data for backend synchronization.
- No contract is deployed to Sepolia before local tests pass.

---

## Day 2 — Frontend, wallet integration, Sepolia, and end-to-end validation

### Phase 6 — Frontend application foundation — **Owner: C**

**Goal:** Build the complete responsive UI around the already-defined API.

- [ ] Create React + TypeScript + Vite frontend.
- [ ] Configure Tailwind CSS.
- [ ] Add Lucide React icons.
- [ ] Add Recharts.
- [ ] Add shared design tokens and layout components.
- [ ] Add responsive navigation and mobile layout.
- [ ] Add explicit Demo Mode indicator.
- [ ] Add loading, empty, error, and success states.

### Phase 7 — Required frontend pages — **Owner: C**

- [ ] Landing page.
- [ ] Borrower dashboard.
- [ ] Lender dashboard.
- [ ] Credit score page.
- [ ] Loan marketplace/request page.
- [ ] Loan details page.
- [ ] Recovery dashboard.
- [ ] Admin/reviewer dashboard.

Each visible interactive control must either:

- Perform a working demo action.
- Call a real backend endpoint.
- Show an explicit unavailable/not-configured state.

Decorative buttons that do nothing are not acceptable.

### Phase 8 — Frontend service integration — **Owner: C**, with A/B interface support

- [ ] Add typed API client.
- [ ] Add auth service integration.
- [ ] Add borrower profile integration.
- [ ] Add evidence and score integration.
- [ ] Add loan quote/request integration.
- [ ] Add repayment integration.
- [ ] Add pool statistics integration.
- [ ] Add recovery and dispute integration.
- [ ] Add transaction-status notifications.
- [ ] Add frontend form validation.

### Phase 9 — Wagmi, Viem, and MetaMask — **Owner: B**, with C UI integration

- [ ] Configure Sepolia chain in Wagmi.
- [ ] Add wallet connect/disconnect.
- [ ] Add chain mismatch handling.
- [ ] Add connected wallet display.
- [ ] Add contract ABI and address configuration.
- [ ] Add transaction preparation calls.
- [ ] Add MetaMask transaction submission.
- [ ] Add pending, confirmed, and failed transaction states.
- [ ] Never display success before a confirmed receipt.

### Phase 10 — Local contract deployment — **Owner: B**, with A/C integration support

- [ ] Deploy contracts to a local Hardhat network.
- [ ] Run contract integration tests.
- [ ] Connect backend read operations to local contracts.
- [ ] Connect frontend wallet actions to local contracts.
- [ ] Verify events update application state.
- [ ] Confirm the demo-mode fallback still works.

### Phase 11 — Sepolia deployment — **Owner: B**, with A/C verification support

Only begin this phase after local contract and integration tests pass.

- [ ] Configure a Sepolia RPC endpoint through environment variables.
- [ ] Fund a dedicated testnet deployer wallet.
- [ ] Deploy `MockUSDC` and protocol contracts.
- [ ] Record deployed addresses in a local untracked `.env`.
- [ ] Verify contract source where appropriate.
- [ ] Mint only test tokens required for the academic demo.
- [ ] Configure frontend contract addresses.
- [ ] Configure backend RPC and contract addresses.
- [ ] Test borrower registration on Sepolia.
- [ ] Test lender deposit and withdrawal on Sepolia.
- [ ] Test loan request and repayment on Sepolia.
- [ ] Test recovery and dispute transaction flows.

**Acceptance criteria:**

- Every successful testnet action has a real transaction hash.
- UI waits for a receipt before showing confirmation.
- Failed or rejected transactions remain failed and visible.
- No private key is stored in frontend code or committed to Git.
- Demo mode remains available when Sepolia variables are absent.

### Phase 12 — End-to-end QA and handoff — **Owner: C**, with A/B sign-off

- [ ] Run backend tests.
- [ ] Run Solidity tests.
- [ ] Run frontend type checking and build.
- [ ] Run API integration tests.
- [ ] Test desktop, tablet, and mobile layouts.
- [ ] Test invalid forms and unauthorized requests.
- [ ] Test expired credit assessment behavior.
- [ ] Test insufficient liquidity behavior.
- [ ] Test failed wallet transactions.
- [ ] Test recovery and dispute role restrictions.
- [ ] Update manual-testing documentation with deployed testnet steps.
- [ ] Add final environment variable documentation.
- [ ] Record known academic-prototype limitations.

---

# API and contract status matrix

| Capability | Current state | Target state |
|---|---|---|
| Health checks | Demo/backend ready | Keep |
| Wallet authentication | Demo nonce/signature | MetaMask signature verification |
| Borrower registration | Demo pending profile | IdentityRegistry transaction |
| Evidence submission | Demo in-memory | PostgreSQL persistence |
| Credit scoring | Working academic model | Optional signed CreditScoreRegistry result |
| Loan quotation | Working demo calculation | Contract-aware quote |
| Loan request | Demo `requested` state | LoanManager transaction |
| Pool statistics | Demo values | LendingPool reads/events |
| Repayment | Planned | LoanManager repayment transaction |
| Recovery | Planned | RecoveryManager transaction |
| Disputes | Planned | DisputeManager workflow |
| Frontend | Not started | Complete responsive React application |
| Sepolia | Not connected | Testnet deployment and verified flows |

---

# Required environment variables

## Backend

```text
APP_ENV=development
DEMO_MODE=true
DATABASE_URL=
SEPOLIA_RPC_URL=
CHAIN_ID=11155111
JWT_SECRET=
```

## Contract addresses

```text
MOCK_USDC_ADDRESS=
IDENTITY_REGISTRY_ADDRESS=
CREDIT_SCORE_REGISTRY_ADDRESS=
LENDING_POOL_ADDRESS=
LOAN_MANAGER_ADDRESS=
RECOVERY_MANAGER_ADDRESS=
DISPUTE_MANAGER_ADDRESS=
```

## Frontend

```text
VITE_API_URL=
VITE_CHAIN_ID=11155111
VITE_DEMO_MODE=true
VITE_MOCK_USDC_ADDRESS=
VITE_IDENTITY_REGISTRY_ADDRESS=
VITE_CREDIT_SCORE_REGISTRY_ADDRESS=
VITE_LENDING_POOL_ADDRESS=
VITE_LOAN_MANAGER_ADDRESS=
VITE_RECOVERY_MANAGER_ADDRESS=
VITE_DISPUTE_MANAGER_ADDRESS=
```

Never commit private keys, RPC secrets, database passwords, or populated
`.env` files.

---

# Repeatable validation commands

## Backend

```powershell
cd "C:\Users\shashank tandan\Desktop\blockchain\backend"
python -m pytest -q
python -m compileall -q app tests
```

## Manual API workflow

Follow [`manual-testing.md`](./manual-testing.md) in order. It already covers
health, demo authentication, borrower registration, evidence, credit
assessment, loan quotes, loan requests, and pool statistics.

## Completion gate

The two-day implementation is complete only when:

- Backend tests pass.
- Contract tests pass.
- Frontend build and type checks pass.
- Demo mode works without blockchain credentials.
- Sepolia flows use real receipts and transaction statuses.
- Manual testing documentation matches the implemented endpoints.
- No completed item in this document is reimplemented unnecessarily.
