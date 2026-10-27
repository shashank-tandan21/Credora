from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def authenticate(wallet: str) -> str:
    nonce_response = client.post("/api/v1/auth/nonce", json={"wallet_address": wallet})
    nonce = nonce_response.json()["nonce"]
    response = client.post(
        "/api/v1/auth/verify",
        json={
            "wallet_address": wallet,
            "nonce": nonce,
            "signature": f"demo:{nonce}",
        },
    )
    return response.json()["access_token"]


def create_assessment(token: str) -> None:
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
    response = client.post("/api/v1/credit/assess", headers=headers, json={})
    assert response.status_code == 200


def test_loan_quote_requires_credit_assessment() -> None:
    token = authenticate("0x0000000000000000000000000000000000000020")
    response = client.post(
        "/api/v1/loans/quote",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": 500, "duration_days": 90},
    )

    assert response.status_code == 422
    assert "assessment" in response.json()["detail"].lower()


def test_loan_quote_and_request_calculate_repayment() -> None:
    token = authenticate("0x0000000000000000000000000000000000000021")
    create_assessment(token)
    headers = {"Authorization": f"Bearer {token}"}

    quote = client.post(
        "/api/v1/loans/quote",
        headers=headers,
        json={"amount": 500, "duration_days": 90},
    )
    assert quote.status_code == 200
    assert quote.json()["eligible_limit"] == 1065.0
    assert quote.json()["interest_rate"] == 12.0
    assert quote.json()["interest_amount"] == 14.79
    assert quote.json()["total_repayment"] == 514.79
    assert len(quote.json()["installments"]) == 3

    request = client.post(
        "/api/v1/loans",
        headers=headers,
        json={"amount": 500, "duration_days": 90},
    )
    assert request.status_code == 201
    assert request.json()["status"] == "requested"
    assert request.json()["total_repayment"] == 514.79

    loans = client.get("/api/v1/loans", headers=headers)
    assert loans.status_code == 200
    assert len(loans.json()) == 1


def test_pool_statistics_are_available() -> None:
    response = client.get("/api/v1/pool/statistics")

    assert response.status_code == 200
    assert response.json()["total_pool_liquidity"] > 0
    assert "utilization_rate" in response.json()
