# REBOUND — Complete Two-Day PR Implementation Plan

## 1. Purpose and completion standard

This document is the execution plan, interface contract, test plan, and
acceptance checklist for the REBOUND academic micro-lending prototype.
Contributors must update it whenever an endpoint, contract, environment
variable, transaction state, or user flow changes.

The implementation must support two clearly separated modes:

| Mode | Purpose | Required behavior |
|---|---|---|
| Demo | Local development and UI work | Works without PostgreSQL, wallet, RPC, or deployed contracts; all simulated actions are visibly labelled |
| Sepolia | Testnet demonstration | Uses real wallet transactions and receipts; no action is shown as confirmed before receipt confirmation |

The two-day target is complete only when all required phases have either passed
their acceptance criteria or are explicitly marked `Not applicable` with a
documented reason. A feature must not be represented as complete merely because
its model, route, or UI shell exists.

## 2. Current repository state

The repository currently contains the FastAPI backend and documentation. The
frontend, Solidity project, migrations, production repositories, and Sepolia
integration are pending.

Completed backend/demo capabilities:

- FastAPI application, API versioning, health endpoints, and settings
- Demo wallet nonce authentication and protected-route dependency
- User, borrower, credit, loan, and pool SQLAlchemy models
- In-memory demo repositories/services
- Borrower registration and profile retrieval
- Financial evidence submission and listing
- Explainable academic credit assessment and history
- Loan quote, loan request, repayment schedule generation, and pool statistics
- Backend tests and repeatable manual API workflow

Important current limitation: SQLAlchemy models and an async database session
factory exist, but the API services still use the in-memory demo store. This is
not PostgreSQL persistence until Phase 1 is complete.

References:

- [Backend README](../backend/README.md)
- [Manual testing guide](./manual-testing.md)

## 3. Product scope

### In scope

1. Borrower onboarding and wallet authentication.
2. Financial evidence and explainable credit scoring.
3. Lender deposits, withdrawals, positions, and pool statistics.
4. Loan quotation, request, funding, disbursement, repayment, and history.
5. Overdue-loan recovery and restructuring milestones.
6. Credit disputes and reviewer/admin decisions.
7. Solidity boundaries for token, identity, score, lending, loan, recovery,
   and dispute workflows.
8. Responsive frontend for borrower, lender, reviewer, and admin roles.
9. Demo mode, local Hardhat deployment, and optional Sepolia deployment.
10. Tests, security checks, operational documentation, and handoff.

### Out of scope

- Production lending or financial advice
- Real customer funds
- Real-world credit bureau integration
- Automated underwriting beyond the documented academic model
- Mainnet deployment
- Custody of user private keys
- Production-grade KYC/AML certification
- Claiming that demo data or scores are suitable for lending decisions

Every out-of-scope item must remain visible as a limitation in the final
documentation.

## 4. Ownership and coordination

| Owner | Primary responsibility | Required sign-off |
|---|---|---|
| A — Backend/data | FastAPI, persistence, repositories, repayments, recovery, disputes, API docs/tests | API compatibility, migrations, authorization |
| B — Blockchain/Web3 | Solidity, Hardhat, OpenZeppelin, deployments, Wagmi/Viem, transaction lifecycle | Contract tests, local deployment, Sepolia evidence |
| C — Frontend/quality | React UI, typed API client, UX states, accessibility, responsive QA, end-to-end testing | UI behavior, browser checks, final QA |

Shared rules:

- A owns backend request/response semantics.
- B owns contract function/event/error semantics.
- C consumes typed interfaces and must not invent incompatible payloads.
- No owner may mark a cross-workstream item complete without evidence from the
  other affected owners.
- Demo behavior must never be presented as a blockchain confirmation.
- Never commit private keys, populated `.env` files, RPC secrets, or database
  passwords.

## 5. Architecture and source-of-truth rules

### Components

- `backend/`: FastAPI application, services, repositories, migrations, and API tests
- `frontend/`: React + TypeScript + Vite application
- `contracts/`: Hardhat project, Solidity contracts, deployment scripts, and tests
- PostgreSQL: persistent application state outside demo mode
- Sepolia: optional testnet execution layer

### Boundary rules

1. The frontend calls the backend for application data and uses the wallet for
   user-authorized blockchain transactions.
2. The backend never receives or stores private keys.
3. A transaction has separate `prepared`, `submitted`, `pending`, `confirmed`,
   and `failed` states. `submitted` or `pending` is not success.
4. Transaction hashes are recorded only after a wallet/provider returns one.
5. A `confirmed` state requires a successful receipt for the expected chain and
   contract action.
6. Backend state changes caused by a chain action must be idempotent and linked
   to the transaction hash.
7. Demo repositories are selected only when `DEMO_MODE=true`; production mode
   must fail explicitly if required persistence or blockchain configuration is
   missing.

### Delivery gates and dependency order

The following gates are mandatory; later work may use mocks, but it may not be
marked complete until its prerequisite gate passes.

| Gate | Prerequisite | Evidence required |
|---|---|---|
| G0 — baseline | None | Existing backend tests and compile check pass |
| G1 — interfaces | G0 | API schemas, contract interfaces, status enums, and environment reference reviewed by A/B/C |
| G2 — backend persistence | G1 | Fresh database migration, repository tests, and demo-mode regression pass |
| G3 — domain workflows | G2 | Repayment, recovery, dispute, lender, and authorization tests pass |
| G4 — contracts | G1 | Hardhat compile, unit tests, and ABI/event/error artifacts pass |
| G5 — local integration | G3 and G4 | Local deployment, event synchronization, and frontend demo flow pass |
| G6 — testnet | G5 | Sepolia smoke-test evidence with receipt hashes and no exposed secrets |
| G7 — release | G3, G5, and optionally G6 | Full quality gates, documentation, review checklist, and owner sign-off complete |

If a prerequisite is deferred, the dependent feature must remain labelled
`blocked`, `demo-only`, or `not configured`; it must not be silently treated as
production-ready.

## 6. Financial and data conventions

These rules must be implemented consistently in Python, PostgreSQL, Solidity,
and TypeScript.

- Use integer smallest units for token amounts on-chain (`MockUSDC` uses
  6 decimals).
- Use `Decimal`/numeric types for off-chain money; do not use binary floating
  point for persisted balances or settlement calculations.
- Store annual rates as basis points or documented decimal values, not
  ambiguous display percentages.
- Round only at documented boundaries. The final installment absorbs any
  rounding remainder so schedule totals equal the repayment total exactly.
- Store timestamps in UTC.
- Store wallet addresses normalized to checksum or lowercase consistently.
- Never derive an authorization decision from client-provided role fields.
- Every aggregate balance must be reconcilable from immutable deposit, loan,
  repayment, withdrawal, and adjustment records.

Current academic scoring weights:

| Component | Weight |
|---|---:|
| Repayment history | 35% |
| Affordability | 25% |
| Cash-flow stability | 15% |
| Debt burden | 15% |
| Evidence quality | 10% |

The score is illustrative. The UI and API must disclose `academic_model=true`
where applicable.

## 7. API contract requirements

All routes are under `/api/v1`. Responses must use the existing Pydantic
schemas where present and must document new schemas in code/OpenAPI.

### Authentication

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/nonce` | Public | Issue one-time wallet nonce |
| POST | `/auth/verify` | Public | Verify signature and issue expiring token |
| POST | `/auth/refresh` | Authenticated, if implemented | Rotate/refresh token |
| POST | `/auth/revoke` | Authenticated, if implemented | Revoke current token |

Demo verification must accept only the documented `demo:<nonce>` form. Real
mode must verify an EIP-4361/Sign-In with Ethereum message, including domain,
URI, chain ID, nonce, issued-at, expiration, and replay protection.

### Borrower and credit

| Method | Route | Purpose |
|---|---|---|
| POST | `/borrowers/register` | Create the authenticated borrower profile |
| GET | `/borrowers/me` | Read the authenticated profile |
| POST | `/credit/evidence` | Submit normalized financial evidence |
| GET | `/credit/evidence` | List the caller's evidence |
| POST | `/credit/assess` | Create a new assessment |
| GET | `/credit/current` | Read the non-expired current assessment |
| GET | `/credit/history` | Read assessment history |

Borrowers may access only their own evidence, assessments, loans, repayments,
recovery requests, and disputes.

### Lender and pool

| Method | Route | Purpose |
|---|---|---|
| POST | `/pool/deposit/prepare` | Prepare a deposit action |
| POST | `/pool/withdraw/prepare` | Validate and prepare a withdrawal |
| GET | `/pool/positions/me` | Read the authenticated lender position |
| GET | `/pool/transactions` | List caller pool transactions |
| GET | `/pool/statistics` | Read aggregate pool statistics |
| POST | `/pool/transactions/{id}/sync` | Idempotently sync a confirmed receipt |

Demo endpoints must return an explicit demo marker. Deposits and withdrawals
must reject amounts below zero, insufficient available balance, and duplicate
idempotency keys.

### Loans and repayments

| Method | Route | Purpose |
|---|---|---|
| POST | `/loans/quote` | Validate eligibility and calculate a quote |
| POST | `/loans` | Create a loan request |
| GET | `/loans` | List caller loans with pagination |
| GET | `/loans/{id}` | Read a loan owned by or visible to the caller |
| POST | `/loans/{id}/fund/prepare` | Prepare funding/disbursement |
| POST | `/loans/{id}/repayments/quote` | Calculate repayment amount |
| POST | `/loans/{id}/repayments/prepare` | Prepare full or partial repayment |
| GET | `/loans/{id}/repayments` | List repayment history and schedule |
| POST | `/transactions/{id}/sync` | Sync a confirmed blockchain transaction |

Loan and repayment mutations require idempotency keys. Concurrent requests
must not reserve the same liquidity twice.

### Recovery and disputes

| Method | Route | Purpose |
|---|---|---|
| GET | `/recovery/overdue` | List eligible overdue loans |
| POST | `/recovery/requests` | Submit a restructuring request |
| GET | `/recovery/requests` | List caller recovery requests |
| POST | `/recovery/requests/{id}/milestones` | Create a milestone |
| POST | `/recovery/milestones/{id}/complete` | Complete a milestone |
| GET | `/recovery/requests/{id}/progress` | Return deterministic progress |
| POST | `/disputes` | Submit a dispute for own assessment |
| GET | `/disputes` | List caller disputes |
| GET | `/reviewer/disputes` | Reviewer queue |
| POST | `/reviewer/disputes/{id}/resolve` | Resolve a dispute |

Reviewer/admin routes must enforce server-side roles and return explicit
`401`/`403` errors. Resolution notes and audit records are required.

### Error and pagination standard

Every error response must have a stable shape:

```json
{
  "error": {
    "code": "assessment_expired",
    "message": "The current credit assessment has expired.",
    "request_id": "uuid"
  }
}
```

Use `400` for malformed input, `401` for missing/invalid authentication,
`403` for insufficient role, `404` for inaccessible/nonexistent resources,
`409` for state or idempotency conflicts, and `422` for valid-but-unprocessable
business input. List endpoints must define `limit`, `cursor` or `offset`, and
stable ordering.

## 8. Persistence and database requirements — Phase 1 — Owner A

### Deliverables

- [ ] Alembic configuration, migration environment, and zero-to-current migration
- [ ] Tables for `users`, `borrower_profiles`, `financial_evidence`,
  `credit_assessments`, `loans`, `lender_positions`, `pool_transactions`,
  `repayments`, `recovery_requests`, `recovery_milestones`, `disputes`,
  `audit_records`, and `idempotency_keys`
- [ ] Foreign keys, unique constraints, indexes, check constraints, timestamps,
  and transaction hashes
- [ ] Repository interfaces and PostgreSQL implementations
- [ ] Demo repository implementation selected by `DEMO_MODE`
- [ ] Startup validation for production configuration
- [ ] Database health/readiness reporting
- [ ] Migration rollback or forward-fix procedure documented
- [ ] Backup/restore verification procedure documented

### Acceptance criteria

- A fresh PostgreSQL instance migrates successfully from zero.
- Re-running migrations is safe.
- Production mode fails clearly when `DATABASE_URL` is absent or invalid.
- Demo mode starts without PostgreSQL.
- Existing response shapes remain compatible.
- Repository tests cover create, read, update, conflict, and rollback paths.

## 9. Repayment workflow — Phase 2 — Owner A

### Deliverables

- [ ] Repayment model, schema, repository, routes, and service
- [ ] Schedule persistence and exact amount reconciliation
- [ ] Full and partial repayment preparation
- [ ] UTC due-date and overdue calculation
- [ ] Transaction lifecycle fields and receipt linkage
- [ ] Duplicate submission protection
- [ ] Failed, replaced, timed-out, and chain-reorg handling documented

### Acceptance criteria

- Schedule totals equal the loan repayment total.
- Overdue status is derived from due dates and outstanding balances.
- Partial payments reduce outstanding principal/interest deterministically.
- No repayment is `confirmed` without receipt evidence.
- Failed or rejected transactions remain visible as failed.
- Restarting the backend does not lose persisted repayment state.

## 10. Recovery and restructuring — Phase 3 — Owner A

### Deliverables

- [ ] Recovery request and milestone models/schemas
- [ ] Overdue-loan listing
- [ ] Restructuring request and schedule validation
- [ ] Milestone creation/completion and progress calculation
- [ ] Linkage to loan, borrower, assessment, and audit history
- [ ] Recovery permissions and state-transition matrix

### Acceptance criteria

- Only eligible overdue loans can create requests.
- Proposed schedules cannot underpay the outstanding amount or contain invalid
  dates/amounts.
- Progress is deterministic from completed milestones.
- Borrowers cannot modify another borrower's recovery records.
- Recovery actions do not claim blockchain confirmation in demo mode.

## 11. Disputes and reviewer APIs — Phase 4 — Owner A

### Deliverables

- [ ] Dispute model, schema, routes, repository, and audit records
- [ ] Borrower submission restricted to the borrower's own assessment
- [ ] Reviewer queue and reviewer/admin role checks
- [ ] Resolution state, notes, timestamps, and acting user
- [ ] Duplicate/open-dispute rules
- [ ] Reviewer conflict-of-interest and reassignment rule documented

### Acceptance criteria

- Non-reviewers receive `403` for reviewer actions.
- Borrowers cannot resolve or edit reviewer decisions.
- Resolution is persisted and visible in history.
- Every score/dispute decision has an audit record.

## 12. Solidity foundation — Phase 5 — Owner B

Create a Hardhat project with pinned compatible dependencies and local tests.
Use OpenZeppelin access control, SafeERC20, ReentrancyGuard, and Pausable where
appropriate.

### Contracts

| Contract | Minimum responsibility |
|---|---|
| `MockUSDC` | Test ERC-20 with controlled minting for demo/test accounts |
| `IdentityRegistry` | Register wallet identity and emit registration event |
| `CreditScoreRegistry` | Store authorized score attestations with expiry/version |
| `LendingPool` | Deposits, available liquidity, lender positions, withdrawals |
| `LoanManager` | Request, fund, disburse, repay, partial repay, and close loans |
| `RecoveryManager` | Record eligible recovery/restructuring actions |
| `DisputeManager` | Submit and resolve disputes with role restrictions |

### Required contract decisions

- Define all public functions, parameter types, return values, events, custom
  errors, and state enums before implementation.
- Use `uint256` smallest token units and document decimal conversion.
- Define roles, role administration, pause behavior, and emergency recovery.
- Define whether contracts are upgradeable; default is non-upgradeable.
- Prevent reentrancy and unauthorized state transitions.
- Emit events containing stable IDs, wallet addresses, amounts, and timestamps.
- Define behavior for cancellation, expiry, partial repayment, late payment,
  failed funding, and duplicate actions.

### Acceptance criteria

- Contracts compile with no warnings that hide correctness issues.
- Unit tests cover successful and rejected transitions, access control,
  arithmetic, pause, reentrancy-sensitive paths, and invalid inputs.
- Events and custom errors are documented for backend synchronization.
- Local deployment produces deterministic address/configuration output.
- Sepolia deployment cannot run before local tests pass.
- ABI, address, event, error, and deployment artifacts are versioned separately
  for local and Sepolia networks.

## 13. Frontend foundation and pages — Phases 6–8 — Owner C

### Foundation

- [ ] React + TypeScript + Vite
- [ ] Tailwind CSS, Lucide React, and Recharts
- [ ] Shared layout, form, notification, loading, error, empty-state, and
  transaction-status components
- [ ] Typed API client generated from or aligned with backend OpenAPI
- [ ] Auth/session store with logout and expiry handling
- [ ] Explicit Demo Mode and Sepolia/network indicators
- [ ] API client timeout, cancellation, retry, and error-normalization behavior

### Required pages

- [ ] Landing page
- [ ] Borrower dashboard
- [ ] Lender dashboard
- [ ] Credit score/evidence page
- [ ] Loan marketplace/request page
- [ ] Loan details and repayment page
- [ ] Recovery dashboard
- [ ] Admin/reviewer dashboard

Every control must perform a working demo action, call a real endpoint, submit
a real wallet transaction, or show an explicit unavailable/not-configured
state. No decorative buttons are permitted.

### Acceptance criteria

- Loading, empty, validation, authorization, network, rejected-wallet,
  pending, confirmed, and failed states are visible and distinct.
- Keyboard navigation, focus visibility, labels, semantic headings, and
  accessible error messages are implemented.
- Layouts are tested at desktop, tablet, and mobile breakpoints.
- No private key or server secret is included in frontend bundles.
- Frontend type checking and production build pass.

## 14. Wallet and transaction integration — Phase 9 — Owner B/C

### Deliverables

- [ ] Wagmi/Viem Sepolia configuration
- [ ] Connect/disconnect and account display
- [ ] Chain mismatch prompt and switch-chain flow
- [ ] Contract ABI/address configuration
- [ ] Transaction preparation and wallet submission
- [ ] Receipt waiting and lifecycle notifications
- [ ] Rejected, reverted, timed-out, and replaced transaction handling
- [ ] Confirmation depth and chain-reorganization policy

### Acceptance criteria

- Wrong-chain actions are blocked or explicitly redirected.
- UI shows `prepared`, `submitted`, `pending`, `confirmed`, and `failed`.
- Success is shown only after a successful receipt on the expected chain.
- User rejection is not converted into a success state.
- Every confirmed action displays its real transaction hash.

## 15. Local deployment — Phase 10 — Owner B

- Deploy all contracts to a local Hardhat network.
- Run contract integration tests against deployed addresses.
- Connect backend reads and frontend wallet actions.
- Verify events update application state.
- Test restart/reconnect behavior.
- Confirm demo mode remains usable without local contracts.

Local completion requires a reproducible command sequence and a generated
address/ABI artifact that is not confused with Sepolia configuration.

## 16. Sepolia deployment — Phase 11 — Owner B

Begin only after local contract and integration tests pass.

- Configure RPC URL and chain ID through environment variables.
- Use a dedicated testnet deployer with minimum required funds.
- Deploy and record `MockUSDC` and protocol addresses in an untracked local
  `.env`.
- Verify source where appropriate.
- Mint only test tokens required by the demo.
- Configure frontend and backend addresses.
- Test borrower registration, lender deposit/withdrawal, loan request/funding,
  repayment, recovery, and dispute flows.
- Capture transaction hashes, receipt status, chain ID, and timestamp for each
  successful test.

Private keys must never be placed in frontend code, CI logs, committed files,
or chat messages. Missing Sepolia variables must leave Demo Mode functional.

## 17. Testing and quality requirements — Phase 12 — Owner C with A/B

### Required checks

```powershell
cd "C:\Users\shashank tandan\Desktop\blockchain\backend"
python -m pytest -q
python -m compileall -q app tests
```

Also run the frontend package's typecheck/build commands and the contracts'
compile/test commands once those projects exist.

The repository must provide one documented command or CI job for each of the
following:

- Backend format, lint, type-check, unit tests, and compile checks
- Migration-from-zero and database integration tests
- Contract format, compile, unit, integration, and coverage checks
- Frontend lint, type-check, unit/component tests, and production build
- Frontend browser smoke tests at the supported desktop and mobile breakpoints
- Secret, dependency, license, and container scans where applicable

Pin or lock dependency versions for backend, frontend, and contracts. Any
upgrade must be reviewed for compatibility and recorded in the work log.

### Test matrix

- Health and readiness
- Nonce expiry, replay, invalid signature, token expiry, and invalid token
- Borrower ownership and duplicate registration
- Evidence validation and assessment expiry/history
- Eligibility, rounding, insufficient liquidity, and concurrent loan requests
- Lender deposit, withdrawal, position, and reconciliation behavior
- Repayment schedule, partial repayment, overdue, and failed transaction
- Recovery eligibility, schedule validation, milestone progress, and ownership
- Dispute ownership, reviewer authorization, resolution, and audit records
- Contract access control, state transitions, events, custom errors, pause,
  reentrancy-sensitive operations, and invalid amounts
- API-to-contract event synchronization and idempotent retries
- Frontend forms, network errors, wallet rejection, pending/failed/confirmed
  states, responsive layouts, and accessibility
- Migration-from-zero and restart persistence

### Quality gates

- No failing tests, type errors, compile errors, or unhandled migration errors.
- New business logic has focused automated tests.
- No known high-severity security finding remains unresolved.
- Manual testing documentation matches implemented routes and responses.
- Test output is recorded in the PR description or linked CI run.
- CI runs on every pull request and the protected branch cannot merge while a
  required check is failing.
- Coverage thresholds are documented by package; if no threshold is feasible,
  the PR records the reason and the uncovered risk.

## 18. Security and privacy requirements

- Validate and normalize all wallet addresses and amounts at API and contract
  boundaries.
- Use real signature verification outside Demo Mode with nonce replay
  protection and domain/chain validation.
- Apply authentication rate limits to nonce and verify endpoints.
- Configure CORS and trusted hosts explicitly; do not use unrestricted
  production wildcards.
- Redact tokens, signatures, private data, RPC URLs with credentials, and
  financial evidence from logs.
- Use least-privilege database and contract roles.
- Do not expose reviewer/admin actions to client-controlled role claims.
- Use parameterized database queries and ORM-bound values.
- Add dependency and secret scanning to CI.
- Document threat assumptions for wallet compromise, RPC failure, malicious
  evidence, replay, duplicate callbacks, and stale frontend state.
- Define financial-evidence retention, deletion, and access-audit rules.
- Define incident handling for leaked credentials, compromised deployer keys,
  incorrect contract addresses, and corrupted synchronization state.
- Run a security review before any Sepolia deployment.

## 18.1 Operations, reliability, and release controls

- Add structured logs with correlation/request IDs and severity levels.
- Add metrics or health indicators for API errors, database connectivity,
  transaction sync failures, queue/retry counts, and pool reconciliation.
- Define request, database, RPC, and wallet-provider timeouts.
- Use bounded retries with backoff only for safe/idempotent operations.
- Provide separate liveness and readiness checks.
- Document deployment, rollback, migration, and contract-address correction
  procedures.
- Define database backup frequency, restore test frequency, and recovery
  objectives appropriate for an academic prototype.
- Define behavior when the RPC is unavailable, the chain ID is wrong, a
  transaction is replaced, or an event is missed.
- Maintain a release checklist containing version, migration status, commit
  SHA, environment, contract addresses, and test evidence.

## 19. Environment and configuration

### Backend

```text
APP_NAME=REBOUND API
APP_ENV=development
API_V1_PREFIX=/api/v1
DEMO_MODE=true
DATABASE_URL=
SEPOLIA_RPC_URL=
CHAIN_ID=11155111
JWT_SECRET=
AUTH_NONCE_EXPIRY_SECONDS=600
```

### Contract addresses

```text
MOCK_USDC_ADDRESS=
IDENTITY_REGISTRY_ADDRESS=
CREDIT_SCORE_REGISTRY_ADDRESS=
LENDING_POOL_ADDRESS=
LOAN_MANAGER_ADDRESS=
RECOVERY_MANAGER_ADDRESS=
DISPUTE_MANAGER_ADDRESS=
```

### Frontend

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

Every variable must have a description, required/optional status, safe example,
and mode applicability in the relevant README. Populated `.env` files remain
untracked.

## 20. Documentation and handoff

Update all of the following when behavior changes:

- Backend README and OpenAPI descriptions
- [Manual testing guide](./manual-testing.md)
- This implementation plan
- Frontend README and environment reference
- Contract README with functions, events, errors, deployment commands, and
  address network
- Final limitations and known-failure documentation

The final handoff must include:

- Changed files and owner
- Commands run and results
- Migration/deployment instructions
- Demo credentials or test-wallet instructions that contain no secrets
- Contract addresses and explorer links, if Sepolia was deployed
- Known limitations and deferred work
- Evidence that Demo Mode still works

## 20.1 Pull request review checklist

The PR description must include:

- [ ] Summary of user-visible behavior and explicitly deferred behavior
- [ ] Scope of changed backend, frontend, contract, migration, and config files
- [ ] API/schema or contract-interface changes, including compatibility impact
- [ ] Database migration and rollback/forward-fix notes
- [ ] Environment-variable and secret-safety review
- [ ] Test commands, results, and CI links
- [ ] Manual QA steps and expected results
- [ ] Screenshots or recordings for material UI changes
- [ ] Transaction hashes and explorer links for Sepolia evidence, if applicable
- [ ] Known limitations, risks, and follow-up issues
- [ ] A/B/C owner approvals and final reviewer approval

## 21. Definition of done

The PR is ready for review only when all applicable checks below are true:

- [ ] Backend persistence and migrations pass from zero.
- [ ] Demo mode works without PostgreSQL, wallet, RPC, or contracts.
- [ ] API schemas, status codes, errors, pagination, and ownership rules are documented.
- [ ] Lender deposit, withdrawal, position, and pool flows work.
- [ ] Repayment, overdue, recovery, and dispute flows work.
- [ ] Contract compilation, unit tests, integration tests, and event checks pass.
- [ ] Frontend pages contain no non-functional interactive controls.
- [ ] Frontend typecheck, build, responsive checks, and accessibility checks pass.
- [ ] Wallet transactions expose accurate lifecycle states.
- [ ] Sepolia flows, if enabled, use real receipts and transaction hashes.
- [ ] No secrets or private keys are committed or exposed.
- [ ] Security, logging, error, and retry behavior is documented.
- [ ] Backend, contract, frontend, and manual tests pass.
- [ ] README files and this plan match the shipped behavior.
- [ ] A/B/C owners have signed off their acceptance criteria.

## 22. Status matrix

| Capability | Current state | Target evidence |
|---|---|---|
| Health checks | Demo/backend ready | Automated health test |
| Wallet authentication | Demo nonce/signature | Real signature tests outside demo |
| Borrower registration | In-memory, pending identity | Persistent record and IdentityRegistry receipt |
| Evidence and scoring | In-memory academic model | PostgreSQL repository tests and disclosure |
| Lender pool | Demo statistics only | Deposit/withdrawal/position/reconciliation tests |
| Loans | Demo requested state | Contract-aware lifecycle and receipt sync |
| Repayment | Not implemented | Schedule, partial repayment, overdue, receipt tests |
| Recovery | Not implemented | Eligibility, milestones, progress, ownership tests |
| Disputes | Not implemented | Reviewer roles, resolution, audit tests |
| Frontend | Not started | Build, typecheck, responsive/accessibility evidence |
| Contracts | Not started | Hardhat compile/unit/integration evidence |
| Local deployment | Not started | Reproducible deployment and event sync |
| Sepolia | Not connected | Real receipt/hash evidence or documented deferral |

## 23. Work log

Use this section during implementation rather than creating separate planning
documents.

| Date | Owner | Phase | Change/evidence | Status |
|---|---|---|---|---|
| 2026-10-28 | Team | Baseline | Plan expanded to include API, lender, contract, security, financial, operations, and QA requirements | Complete |
