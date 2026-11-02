# REBOUND Manual Backend Testing

This guide documents the current demo-mode backend flow so it can be repeated
without a frontend or deployed contracts.

## 1. Start the API

From PowerShell:

```powershell
cd "C:\Users\shashank tandan\Desktop\blockchain\backend"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Keep the API terminal open. The interactive API reference is available at
`http://127.0.0.1:8000/docs`.

The default configuration uses `DEMO_MODE=true`, so PostgreSQL and Sepolia are
not required for this workflow. Demo data is held in process memory and resets
when the API restarts.

## 2. Check service health

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
```

Expected result contains:

```json
{"status":"ok"}
```

## 3. Request a wallet nonce

```powershell
$wallet = "0x0000000000000000000000000000000000000004"
$nonceResponse = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/auth/nonce `
  -ContentType "application/json" `
  -Body (@{wallet_address=$wallet} | ConvertTo-Json)

$nonceResponse
```

Copy the returned `nonce`. It is one-time-use and expires after the configured
nonce lifetime.

## 4. Authenticate in demo mode

```powershell
$verifyResponse = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/auth/verify `
  -ContentType "application/json" `
  -Body (@{
    wallet_address=$wallet
    nonce=$nonceResponse.nonce
    signature="demo:$($nonceResponse.nonce)"
  } | ConvertTo-Json)

$token = $verifyResponse.access_token
$headers = @{ Authorization = "Bearer $token" }
$verifyResponse
```

This `demo:<nonce>` signature is intentionally not an Ethereum signature. It
only makes local API testing possible before MetaMask and Sepolia are configured.

## 5. Register a borrower

```powershell
$registration = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/borrowers/register `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    display_name="Demo Borrower"
    bio="Testing the REBOUND borrower workflow"
  } | ConvertTo-Json)

$registration
```

Expected values:

```text
identity_status: pending
wallet_address: the authenticated wallet
registration_transaction_hash: null
```

The `pending` status is deliberate. No blockchain transaction has been
submitted yet.

## 6. Read the borrower profile

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri http://127.0.0.1:8000/api/v1/borrowers/me `
  -Headers $headers
```

Calling registration again for the same wallet should return HTTP `409`.
Calling the profile endpoint without the bearer token should return HTTP `401`.

## 7. Submit financial evidence

```powershell
$evidence = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/credit/evidence `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    evidence_type="bank_statement"
    period_months=6
    repayment_history_score=80
    affordability_score=70
    cash_flow_stability_score=60
    debt_burden_score=50
    evidence_quality_score=90
    notes="Six months of demo evidence"
  } | ConvertTo-Json)

$evidence
```

Each score is an illustrative normalized value from `0` to `100`; it is not
automatically extracted from a real bank statement in this prototype.

## 8. Generate a credit assessment

```powershell
$assessment = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/credit/assess `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{validity_days=90} | ConvertTo-Json)

$assessment
```

For the example evidence above, the expected score is `71.0`:

```text
80 × 35% = 28.0
70 × 25% = 17.5
60 × 15% = 9.0
50 × 15% = 7.5
90 × 10% = 9.0
Total       71.0
```

The response includes all five weighted components, an explanation, validity
dates, and `academic_model: true`.

## 9. Read current score and history

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri http://127.0.0.1:8000/api/v1/credit/current `
  -Headers $headers

Invoke-RestMethod `
  -Method Get `
  -Uri http://127.0.0.1:8000/api/v1/credit/history `
  -Headers $headers
```

Generating an assessment without evidence returns HTTP `422`. Credit endpoints
without the bearer token return HTTP `401`.

## 10. Request a loan quote

```powershell
$quote = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/loans/quote `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    amount=500
    duration_days=90
  } | ConvertTo-Json)

$quote
```

The current demo model uses a `12%` annual interest rate. For a `500` MockUSDC
loan over `90` days:

```text
Interest = 500 × 12% × 90 / 365 = 14.79
Total repayment = 514.79
```

The score from the earlier example (`71`) produces an eligible limit of
`1065.00 MockUSDC` using `score × 15`, capped at `2000`.

## 11. Submit a loan request

```powershell
$loan = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/loans `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    amount=500
    duration_days=90
  } | ConvertTo-Json)

$loan
```

The initial status is `requested`. This does not represent a blockchain
disbursement and does not claim that a loan transaction was confirmed.

## 12. Read loans and pool statistics

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri http://127.0.0.1:8000/api/v1/loans `
  -Headers $headers

Invoke-RestMethod `
  -Method Get `
  -Uri http://127.0.0.1:8000/api/v1/pool/statistics
```

The demo pool starts with `25000 MockUSDC` of available liquidity and reserves
the requested principal when a demo loan request is created.

## 13. Local blockchain workflow

This section exercises the contracts, the backend receipt verification, and the
frontend wallet flows on a local Hardhat chain. No real funds or keys are used;
Hardhat's development accounts and their keys are public test values.

### 13.1 Start the chain and deploy

```powershell
cd contracts
npm ci
npm test                 # expected: 97 passing
npm run node             # keep this terminal open

# second terminal
cd contracts
npm run deploy:local
npm run smoke:local      # expected: 20 confirmed transactions, reconciliation line
```

Expected addresses on a fresh node: `MockUSDC` at
`0x5FbDB2315678afecb367f032d93F642f64180aa3` and `IdentityRegistry` at
`0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` (full list in
`contracts/deployments/localhost.env.example`).

### 13.2 Run the backend against the chain

Set `SEPOLIA_RPC_URL=http://127.0.0.1:8545`, `CHAIN_ID=31337`, and the seven
`*_ADDRESS` values from `localhost.env.example` in `backend/.env`, then start
uvicorn. `GET /api/v1/chain/config` should report `"network": "hardhat-local"`
and `"contracts_configured": true` and must not contain the RPC URL.

### 13.3 Verify an identity registration receipt

1. Authenticate as a Hardhat account and register a borrower (sections 3-5).
2. Call `POST /api/v1/borrowers/me/identity/sync` with
   `{"transaction_hash": "0x<64 hex>"}` for a hash that does not exist.
   Expected: HTTP `409`, identity still `pending`.
3. From that wallet, call `IdentityRegistry.register(keccak256(profile id))`
   (the frontend does this in step 13.4).
4. Sync again with the real hash. Expected: HTTP `200`, `identity_status:
   registered`, and `registration_transaction_hash` equal to the hash.
5. Repeat the same request: `200`. Use a different hash: `409`.

### 13.4 Frontend wallet flows

Start the frontend with `VITE_CHAIN_ID=31337` and `VITE_DEMO_MODE=false`, add
network `http://127.0.0.1:8545` (chain 31337) to MetaMask, and import Hardhat
accounts #0 (operator) and another account (borrower/lender).

| Step | Expected |
|---|---|
| Wallet on another network | Header shows "Switch to Hardhat Local"; actions are disabled with a notice |
| Borrower → Attest Identity On-chain | Transaction panel walks Prepared → Submitted → Pending → Confirmed; banner says the backend verified the receipt; card shows the backend-verified hash |
| Switch to account #0 → Reviewer Desk → Attest score (71) for the borrower | Confirmed; role chips show all operator roles |
| Borrower → Request Loan | Exact on-chain quote; after confirmation "funded and disbursed" with the loan id |
| My Facilities → Get test mUSDC, then Repay in full | Two transactions (approve, repay) confirmed; loan shows as closed |
| Lending Pool → Deposit 250 | Approve (if needed) and deposit confirmed; position shows shares and value |
| Get test mUSDC twice | Second attempt fails with "once every 24 hours"; nothing is shown as success |
| Reject a request in the wallet | Panel shows "Rejected in wallet"; no hash, no success |
| Switch to Demo Mode | Lending position badge reads "Demo position"; messages say simulated |

The same flows run unattended with `npm run test:browser:local` in `frontend/`.

## Current limitations

- Demo users and borrower profiles are in-memory only.
- Evidence and credit assessments are also in-memory only.
- Loans and pool statistics are also in-memory demo data.
- In on-chain mode, deposits, withdrawals, loans, repayments, disputes, and
  recovery run against the contracts, but the backend only ingests identity
  registration receipts; other events are not yet synchronized to the API.
- Score attestations are published by an operator wallet, not automatically
  from backend assessments.
- Score inputs are manually supplied normalized demo values.
- The model is illustrative and not validated for real lending decisions.
- Ethereum wallet signature verification is not enabled.
- PostgreSQL migrations are not yet added.
- `registration_transaction_hash` is set only after a verified
  `IdentityRegistry` receipt, which requires a configured chain.
- Sepolia is not deployed yet (see the implementation plan, Phase 11).
