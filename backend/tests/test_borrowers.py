from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
WALLET = "0x0000000000000000000000000000000000000002"


def authenticate(wallet: str = WALLET) -> str:
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


def test_borrower_registration_and_profile() -> None:
    token = authenticate()
    headers = {"Authorization": f"Bearer {token}"}

    registration = client.post(
        "/api/v1/borrowers/register",
        headers=headers,
        json={"display_name": "Asha Borrower", "bio": "Small business owner"},
    )

    assert registration.status_code == 201
    assert registration.json()["identity_status"] == "pending"
    assert registration.json()["wallet_address"] == WALLET

    profile = client.get("/api/v1/borrowers/me", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["display_name"] == "Asha Borrower"


def test_borrower_routes_require_authentication() -> None:
    response = client.get("/api/v1/borrowers/me")
    assert response.status_code == 401


def test_token_cannot_be_reused_for_another_wallet() -> None:
    original_wallet = "0x0000000000000000000000000000000000000005"
    token = authenticate(original_wallet)
    other_wallet = "0x0000000000000000000000000000000000000003"
    other_token = authenticate(other_wallet)

    response = client.post(
        "/api/v1/borrowers/register",
        headers={"Authorization": f"Bearer {token}"},
        json={"display_name": "Original Wallet"},
    )

    assert response.status_code == 201
    assert response.json()["wallet_address"] == original_wallet
    assert other_token != token
