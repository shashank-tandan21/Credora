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

Demo wallet verification accepts a signature in the form `demo:<nonce>`. This is
only a local development mechanism; it is not Ethereum signature verification.
Production authentication must use a wallet signature verifier before `DEMO_MODE`
is disabled.

Repeatable manual API testing steps are documented in
[`../docs/manual-testing.md`](../docs/manual-testing.md).
