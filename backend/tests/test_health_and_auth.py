from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
WALLET = "0x0000000000000000000000000000000000000001"


def test_health_endpoints() -> None:
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/api/v1/health").json()["status"] == "ok"


def test_demo_wallet_authentication() -> None:
    nonce_response = client.post("/api/v1/auth/nonce", json={"wallet_address": WALLET})
    assert nonce_response.status_code == 200
    nonce = nonce_response.json()["nonce"]

    verify_response = client.post(
        "/api/v1/auth/verify",
        json={
            "wallet_address": WALLET,
            "nonce": nonce,
            "signature": f"demo:{nonce}",
        },
    )

    assert verify_response.status_code == 200
    assert verify_response.json()["user"]["wallet_address"] == WALLET
    assert verify_response.json()["user"]["demo_mode"] is True


def test_invalid_demo_signature_is_rejected() -> None:
    nonce_response = client.post("/api/v1/auth/nonce", json={"wallet_address": WALLET})
    nonce = nonce_response.json()["nonce"]

    response = client.post(
        "/api/v1/auth/verify",
        json={
            "wallet_address": WALLET,
            "nonce": nonce,
            "signature": "not-a-valid-demo-signature",
        },
    )

    assert response.status_code == 401
