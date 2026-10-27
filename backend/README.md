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
will be added behind the same service boundaries.

## Initial endpoints

- `GET /health`
- `GET /api/v1/health`
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

Demo wallet verification accepts a signature in the form `demo:<nonce>`. This is
only a local development mechanism; it is not Ethereum signature verification.
Production authentication must use a wallet signature verifier before `DEMO_MODE`
is disabled.

Repeatable manual API testing steps are documented in
[`../docs/manual-testing.md`](../docs/manual-testing.md).
