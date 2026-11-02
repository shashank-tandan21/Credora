# REBOUND Backend

FastAPI foundation for the REBOUND academic micro-lending prototype.

## Run locally

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

The API starts without PostgreSQL when `DEMO_MODE=true`. Database-backed features
use the SQLAlchemy models and Alembic migration below the same service
boundaries.

## Database migrations

Production mode requires `DATABASE_URL` to be a PostgreSQL URL and validates
that requirement at startup. With the backend environment configured, run:

```powershell
alembic upgrade head
```

The initial migration creates the complete application schema from an empty
database. Re-running it is safe. For a local development rollback, use
`alembic downgrade base`; production rollback should use a reviewed
forward-fix migration after a backup.

## Initial endpoints

- `GET /health`
- `GET /api/v1/health`
- `GET /api/v1/health/readiness`
- `POST /api/v1/auth/nonce`
- `POST /api/v1/auth/verify`
- `POST /api/v1/borrowers/register`
- `GET /api/v1/borrowers/me`
- `POST /api/v1/credit/evidence`
- `POST /api/v1/credit/assess`
- `GET /api/v1/credit/current`
- `GET /api/v1/credit/history`
- `POST /api/v1/loans/quote`
- `POST /api/v1/loans`
- `GET /api/v1/loans`
- `GET /api/v1/pool/statistics`
- `GET /api/v1/chain/config`
- `POST /api/v1/borrowers/me/identity/sync`

Demo wallet verification accepts a signature in the form `demo:<nonce>`. This is
only a local development mechanism; it is not Ethereum signature verification.
Production authentication must use a wallet signature verifier before `DEMO_MODE`
is disabled.

## Blockchain configuration

The backend only reads from the chain; it never signs transactions or stores private
keys. `GET /api/v1/chain/config` reports the configured chain and contract addresses
(never the RPC URL, which may embed an API key) so the frontend can show a
not-configured state.

`POST /api/v1/borrowers/me/identity/sync` takes the `transaction_hash` of the borrower's
`IdentityRegistry.register` call. The profile becomes `registered` only when the receipt
exists on `CHAIN_ID`, has status 1, contains an `IdentityRegistered` event emitted by
`IDENTITY_REGISTRY_ADDRESS` for the caller's wallet, and has `CHAIN_CONFIRMATIONS`
confirmations. Responses:

| Status | Meaning |
|---|---|
| `200` | Verified and linked; repeating the same hash is idempotent |
| `404` | No borrower profile for the caller |
| `409` | No receipt yet, too few confirmations, or a different hash is already linked |
| `422` | Malformed hash, failed transaction, or no matching event for the caller |
| `503` | Chain not configured, RPC unavailable, or RPC on the wrong chain |

| Variable | Required | Mode | Description |
|---|---|---|---|
| `SEPOLIA_RPC_URL` | Production | Sepolia, local chain | JSON-RPC endpoint; `http://127.0.0.1:8545` for a local Hardhat node |
| `CHAIN_ID` | Yes (default `11155111`) | All | `11155111` Sepolia or `31337` local Hardhat |
| `CHAIN_CONFIRMATIONS` | No (default `1`) | Sepolia, local chain | Confirmations required before a receipt counts |
| `CHAIN_RPC_TIMEOUT_SECONDS` | No (default `10`) | Sepolia, local chain | Per-request RPC timeout |
| `*_ADDRESS` (7 contracts) | Production | Sepolia, local chain | From `contracts/deployments/<network>.json` |

With `DEMO_MODE=false`, startup fails unless the RPC URL, a supported `CHAIN_ID`, and
all seven contract addresses are set. In demo mode they are optional and chain-backed
endpoints return `503` until configured. Event topics come from the generated
`app/services/chain_events.py`; regenerate it with `npm run export` in `contracts/`.

Repeatable manual API testing steps are documented in
[`../docs/manual-testing.md`](../docs/manual-testing.md).
