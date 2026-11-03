from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app
from app.repositories import demo_store


client = TestClient(app)


def authenticate(wallet: str) -> str:
    nonce = client.post("/api/v1/auth/nonce", json={"wallet_address": wallet}).json()["nonce"]
    response = client.post(
        "/api/v1/auth/verify",
        json={"wallet_address": wallet, "nonce": nonce, "signature": f"demo:{nonce}"},
    )
    return response.json()["access_token"]


def create_loan(token: str) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    client.post(
        "/api/v1/credit/evidence",
        headers=headers,
        json={
            "evidence_type": "bank_statement",
            "period_months": 6,
            "repayment_history_score": 80,
            "affordability_score": 70,
            "cash_flow_stability_score": 60,
            "debt_burden_score": 50,
            "evidence_quality_score": 90,
        },
    )
    client.post("/api/v1/credit/assess", headers=headers, json={})
    return client.post(
        "/api/v1/loans",
        headers=headers,
        json={"amount": 500, "duration_days": 90},
    ).json()


def test_repayment_requires_confirmation_and_is_idempotent() -> None:
    wallet = "0x0000000000000000000000000000000000000101"
    token = authenticate(wallet)
    loan = create_loan(token)
    headers = {"Authorization": f"Bearer {token}"}

    prepared = client.post(
        f"/api/v1/loans/{loan['id']}/repayments/prepare",
        headers=headers,
        json={"installment_number": 1, "idempotency_key": "repayment-101"},
    )
    assert prepared.status_code == 200
    assert prepared.json()["status"] == "prepared"
    assert prepared.json()["amount"] == 171.6

    repeated = client.post(
        f"/api/v1/loans/{loan['id']}/repayments/prepare",
        headers=headers,
        json={"installment_number": 1, "idempotency_key": "repayment-101"},
    )
    assert repeated.json()["id"] == prepared.json()["id"]

    synced = client.post(
        f"/api/v1/repayments/{prepared.json()['id']}/sync",
        headers=headers,
        json={
            "status": "confirmed",
            "transaction_hash": "0x" + "1" * 64,
        },
    )
    assert synced.status_code == 200
    assert synced.json()["status"] == "confirmed"
    assert client.get(f"/api/v1/loans/{loan['id']}/repayments", headers=headers).json()[0]["status"] == "confirmed"


def test_recovery_rejects_current_loan_and_tracks_milestone_progress() -> None:
    wallet = "0x0000000000000000000000000000000000000102"
    token = authenticate(wallet)
    loan = create_loan(token)
    headers = {"Authorization": f"Bearer {token}"}
    stored_loan = demo_store.loans_by_wallet[wallet][0]
    stored_loan.status = "overdue"

    response = client.post(
        "/api/v1/recovery/requests",
        headers=headers,
        json={
            "loan_id": loan["id"],
            "proposed_total": 514.79,
            "proposed_due_date": (datetime.now(UTC) + timedelta(days=30)).isoformat(),
            "reason": "Temporary stipend delay requires a revised schedule.",
        },
    )
    assert response.status_code == 201
    recovery_id = response.json()["id"]

    milestone = client.post(
        f"/api/v1/recovery/requests/{recovery_id}/milestones",
        headers=headers,
        json={"title": "First payment", "amount": 171.6, "due_date": "2099-01-01"},
    )
    assert milestone.status_code == 200
    milestone_id = milestone.json()["milestones"][0]["id"]
    completed = client.post(
        f"/api/v1/recovery/milestones/{milestone_id}/complete",
        headers=headers,
    )
    assert completed.status_code == 200
    progress = client.get(
        f"/api/v1/recovery/requests/{recovery_id}/progress", headers=headers
    )
    assert progress.json()["progress_percent"] == 100


def test_dispute_ownership_duplicate_and_reviewer_authorization() -> None:
    wallet = "0x0000000000000000000000000000000000000103"
    token = authenticate(wallet)
    headers = {"Authorization": f"Bearer {token}"}
    client.post(
        "/api/v1/credit/evidence",
        headers=headers,
        json={
            "evidence_type": "bank_statement",
            "period_months": 6,
            "repayment_history_score": 80,
            "affordability_score": 70,
            "cash_flow_stability_score": 60,
            "debt_burden_score": 50,
            "evidence_quality_score": 90,
        },
    )
    assessment = client.post("/api/v1/credit/assess", headers=headers, json={}).json()
    dispute = client.post(
        "/api/v1/disputes",
        headers=headers,
        json={"assessment_id": assessment["id"], "reason": "The evidence was not fully considered."},
    )
    assert dispute.status_code == 201
    duplicate = client.post(
        "/api/v1/disputes",
        headers=headers,
        json={"assessment_id": assessment["id"], "reason": "The evidence was not fully considered."},
    )
    assert duplicate.status_code == 409
    assert client.get("/api/v1/reviewer/disputes", headers=headers).status_code == 403


def test_lender_deposit_withdrawal_are_idempotent_and_confirmed() -> None:
    wallet = "0x0000000000000000000000000000000000000104"
    token = authenticate(wallet)
    auth_headers = {"Authorization": "Bearer " + token}
    headers = {"Authorization": f"Bearer {token}"}

    deposit = client.post(
        "/api/v1/pool/deposit",
        headers=auth_headers,
        json={"amount": 1000, "idempotency_key": "deposit-104"},
    )
    assert deposit.status_code == 200
    assert deposit.json()["status"] == "prepared"
    repeated = client.post(
        "/api/v1/pool/deposit",
        headers=auth_headers,
        json={"amount": 1000, "idempotency_key": "deposit-104"},
    )
    assert repeated.json()["id"] == deposit.json()["id"]

    confirmed = client.post(
        f"/api/v1/pool/transactions/{deposit.json()['id']}/sync",
        headers=auth_headers,
        json={"status": "confirmed", "transaction_hash": "0x" + "4" * 64},
    )
    assert confirmed.json()["status"] == "confirmed"
    position = client.get("/api/v1/pool/me", headers=auth_headers)
    assert position.json()["current_value"] == 1000

    withdrawal = client.post(
        "/api/v1/pool/withdraw",
        headers=auth_headers,
        json={"amount": 250, "idempotency_key": "withdraw-104"},
    )
    assert withdrawal.status_code == 200
    client.post(
        f"/api/v1/pool/transactions/{withdrawal.json()['id']}/sync",
        headers=auth_headers,
        json={"status": "confirmed", "transaction_hash": "0x" + "5" * 64},
    )
    assert client.get("/api/v1/pool/me", headers=auth_headers).json()["current_value"] == 750
