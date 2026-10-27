from fastapi.testclient import TestClient

from app.main import app
from app.services.scoring_service import ScoreInputs, calculate_score


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


def test_weighted_score_is_explainable() -> None:
    result = calculate_score(ScoreInputs(80, 70, 60, 50, 90))

    assert result.score == 71.0
    assert result.risk_category == "Fair"
    assert result.contributions["Repayment history"] == (80, 28.0)
    assert result.contributions["Evidence quality"] == (90, 9.0)
    assert result.explanation[-1].startswith("This is an academic prototype")


def test_assessment_requires_evidence() -> None:
    token = authenticate("0x0000000000000000000000000000000000000010")
    response = client.post(
        "/api/v1/credit/assess",
        headers={"Authorization": f"Bearer {token}"},
        json={},
    )

    assert response.status_code == 422
    assert "evidence" in response.json()["detail"].lower()


def test_evidence_assessment_and_history() -> None:
    token = authenticate("0x0000000000000000000000000000000000000011")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "evidence_type": "bank_statement",
        "period_months": 6,
        "repayment_history_score": 80,
        "affordability_score": 70,
        "cash_flow_stability_score": 60,
        "debt_burden_score": 50,
        "evidence_quality_score": 90,
        "notes": "Six months of demo evidence",
    }

    evidence = client.post("/api/v1/credit/evidence", headers=headers, json=payload)
    assert evidence.status_code == 201
    assert evidence.json()["evidence_type"] == "bank_statement"

    assessment = client.post(
        "/api/v1/credit/assess",
        headers=headers,
        json={"validity_days": 30},
    )
    assert assessment.status_code == 200
    assert assessment.json()["score"] == 71.0
    assert assessment.json()["academic_model"] is True
    assert len(assessment.json()["components"]) == 5

    current = client.get("/api/v1/credit/current", headers=headers)
    history = client.get("/api/v1/credit/history", headers=headers)
    assert current.status_code == 200
    assert history.status_code == 200
    assert history.json()[0]["id"] == current.json()["id"]
