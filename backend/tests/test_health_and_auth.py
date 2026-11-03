from types import SimpleNamespace

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient

from app.main import app
from app.config import Settings
from app.schemas.auth import VerifySignatureRequest
import app.services.auth_service as auth_module


client = TestClient(app)
WALLET = "0x0000000000000000000000000000000000000001"


def test_health_endpoints() -> None:
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/api/v1/health").json()["status"] == "ok"


def test_demo_readiness_does_not_require_database() -> None:
    response = client.get("/api/v1/health/readiness")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "mode": "demo"}


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


def test_production_signature_verification_recovers_wallet(monkeypatch) -> None:
    settings = Settings(
        demo_mode=False,
        database_url="postgresql+asyncpg://user:pass@localhost/db",
        sepolia_rpc_url="http://localhost:8545",
        jwt_secret="x" * 32,
    )
    account = Account.create()
    tokens: dict[str, str] = {}

    class FakeRepository:
        async def get_or_create_user(self, wallet: str, role: str = "borrower"):
            return SimpleNamespace(id="user-id", role="reviewer")

        async def create_token(self, wallet: str, token: str) -> None:
            tokens[token] = wallet

        async def get_user_for_token(self, token: str) -> str | None:
            return tokens.get(token)

        async def get_user_role(self, wallet: str) -> str | None:
            return "reviewer"

    service = auth_module.AuthService()
    monkeypatch.setattr(auth_module, "get_settings", lambda: settings)
    monkeypatch.setattr(auth_module, "get_repository", lambda: FakeRepository())
    challenge = service.create_nonce(account.address)
    signature = account.sign_message(encode_defunct(text=challenge.message)).signature.hex()

    response = __import__("asyncio").run(
        service.verify_signature(
            VerifySignatureRequest(
                wallet_address=account.address,
                nonce=challenge.nonce,
                signature=signature,
                message=challenge.message,
            )
        )
    )

    assert response.user.wallet_address == account.address.lower()
    assert response.user.role == "reviewer"
    assert response.user.demo_mode is False
