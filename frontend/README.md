# Credora Frontend

Modern, accessible, institutional-grade interface for the **Credora (REBOUND)** academic micro-lending protocol. Designed and maintained by **Owner C (Frontend / Quality)**; the wallet and transaction layer (`src/web3/`, `src/components/web3/`) is maintained by **Owner B (Blockchain / Web3)**.

## Core Features

- **Dual Theme Support**: System-aware and user-toggleable Light/Dark modes using customized institutional palettes (Cobalt, Deep Obsidian, Spruce Emerald, and Warm Amber).
- **Persona Context Switcher**: Seamless switching between **Borrower**, **Lender**, and **Reviewer** perspectives.
- **Explainable Credit Studio**: 5-factor interactive slider simulator with live radar charts, factor explainability notes, and formal assessment disputes.
- **Micro-Loan Marketplace**: Live quotation simulator (30–365 days), fixed 12% APR calculation, and exact-cent amortized repayment schedules.
- **Lending Pool & Liquidity Desk**: Real-time TVL, pool utilization gauge, supply/redeem actions, and lender position tracking.
- **Reviewer Adjudication Desk**: Protected reviewer queue to evaluate credit disputes with audit logging.
- **Dual Mode Transparency**: Clear visible indicators distinguishing simulated **Demo Mode** from real on-chain transactions on **Sepolia** or a **local Hardhat** chain.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Tailwind-merge + Clsx
- **Icons**: Lucide React
- **Data Visualization**: Recharts (Radar, Progress & Amortization)
- **Wallet / chain**: wagmi 3 + viem 2 + TanStack Query (injected wallets such as MetaMask)
- **API Architecture**: Typed API client mirroring FastAPI Pydantic models with automatic offline demo store fallback.

## Quickstart

```powershell
# 1. Install dependencies
cd frontend
npm install

# 2. Configure environment
Copy-Item .env.example .env

# 3. Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Demo Mode and on-chain mode

The header pill switches modes. Hardhat Local on-chain mode is the default
(`VITE_CHAIN_ID=31337`, `VITE_DEMO_MODE=false`) so wallet transactions use local ETH
for gas. Set `VITE_DEMO_MODE=true` to use simulated data without a wallet.

| Mode | Data and actions | Wallet |
|---|---|---|
| Demo Mode | Backend demo API or the in-browser demo store. Every result is labelled simulated; no transaction hash is ever shown or invented. | Not used |
| On-chain (`Sepolia` or `Hardhat Local`) | Pool, position, loan, eligibility, dispute, and recovery data are read from the contracts. Actions are wallet transactions. | Injected wallet on `VITE_CHAIN_ID` |

On-chain actions available in the UI:

| Page | Actions |
|---|---|
| Lending Pool | Claim test mUSDC (faucet), deposit (exact-amount approve + deposit), withdraw |
| Borrower → My Facilities | Register identity (then the backend verifies the receipt), pay next installment, repay in full, record overdue status, request restructuring, cancel a queued request |
| Borrower → Credit Studio | Open a dispute against your on-chain score attestation |
| Borrower → Request Loan | On-chain eligibility and exact quote, request loan (auto-funded when the pool has liquidity) |
| Reviewer Desk → On-chain Operations | Attest scores, fund queued loans, mark overdue/defaulted, resolve disputes, approve/reject recovery plans, complete milestones. Buttons follow the roles the connected wallet holds on-chain; the contracts enforce them. |

### Transaction lifecycle

Every on-chain action goes through `src/web3/transactions.ts` and is shown in the
transaction panel (bottom right):

| State | Meaning |
|---|---|
| `prepared` | The call was simulated successfully on the target chain; the wallet prompt follows. A revert here never opens the wallet. |
| `submitted` | The wallet returned a transaction hash. |
| `pending` | Waiting for `VITE_CONFIRMATIONS` confirmations. Not final. |
| `confirmed` | Receipt has status `success`, on the target chain, from the expected contract. Only now is success shown. |
| `failed` | Rejected in wallet, reverted (custom error decoded to a readable message), timed out, replaced or cancelled, wrong network, or not configured. |

- **Wrong network**: actions are blocked and the header offers a switch to the target chain.
- **Replaced transactions**: a sped-up (repriced) transaction is followed to its replacement; a cancelled or replaced one is reported as failed even if the replacement succeeded.
- **Timeouts**: after `VITE_TX_TIMEOUT_MS` the hash is still shown so it can be checked before retrying.
- **Reorgs**: Sepolia waits for 2 confirmations by default; local Hardhat does not reorg.
- **Amounts** are parsed straight to 6-decimal integer units; floating point is used for display only.
- **Approvals** are for the exact amount, never unlimited, and are skipped when the allowance already covers it.
- No private key or server secret is part of the bundle; the wallet signs everything.

## Environment

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No (default `http://127.0.0.1:8000`) | Backend URL for the dev-server `/api` proxy |
| `VITE_CHAIN_ID` | No (default `31337`) | `31337` local Hardhat or `11155111` Sepolia |
| `VITE_DEMO_MODE` | No (default `false`) | `true` starts in Demo Mode; `false` starts on-chain |
| `VITE_RPC_URL` | No | Read RPC; bundled into the browser, so use a public or domain-restricted endpoint |
| `VITE_ETH_USD_FEED_ADDRESS` | Sepolia: no (defaults to the Sepolia ETH/USD feed) | Chainlink AggregatorV3-compatible ETH/USD feed; local deployments generate a mock feed address |
| `VITE_CONFIRMATIONS` | No (2 Sepolia, 1 local) | Confirmation depth before success |
| `VITE_TX_TIMEOUT_MS` | No (default `180000`) | Receipt wait before reporting a timeout |
| `VITE_*_ADDRESS` (7) | Sepolia: yes | Contract addresses. On chain 31337 they default to the deterministic local deployment in `src/web3/generated/localDeployment.ts`; Sepolia never falls back. |

`src/web3/generated/` is produced by `npm run export` in `contracts/`; do not edit it by hand.

When on-chain mode is connected, the frontend signs the backend's returned
authentication challenge with the connected wallet. Demo Mode continues to use
the local `demo:<nonce>` mechanism and never requests a wallet signature.

## Running against a local chain

```powershell
# contracts/
npm run node                 # terminal 1
npm run deploy:local         # terminal 2

# backend/ (verifies identity receipts against the local chain)
$env:SEPOLIA_RPC_URL="http://127.0.0.1:8545"; $env:CHAIN_ID="31337"
# plus the *_ADDRESS values from contracts/deployments/localhost.env.example
uvicorn app.main:app --port 8000

# frontend/
$env:VITE_CHAIN_ID="31337"; $env:VITE_DEMO_MODE="false"
npm run dev
```

In MetaMask, add the network `http://127.0.0.1:8545` (chain id 31337) and import Hardhat
test accounts (their keys are public and printed by `npm run node`; never use them on a
real network). Account #0 holds every operator role.

## Quality & Verification Commands

```powershell
npm run typecheck            # tsc -b
npm run lint                 # oxlint
npm test                     # unit tests (units, error classification, lifecycle engine)
npm run build                # type check and production build

# With the local chain running (see above):
npm run test:e2e:local       # transaction engine against the deployed contracts
npm run test:browser:local   # browser smoke test of the on-chain UI (needs dev server + backend)
```

`test:browser:local` drives an installed Edge or Chrome (`BROWSER_PATH` overrides it) with
an injected EIP-1193 provider backed by the node's unlocked accounts, so no wallet
extension is needed. It covers connect, identity registration with backend
verification, attestation, borrowing, repayment, deposit, a revert shown as failed,
Demo Mode labelling, phone-width layout, and the wrong-network block. Set `BASE_URL` if
the dev server is not on port 3000.
