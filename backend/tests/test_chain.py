import json
from collections.abc import Callable, Iterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.services.chain_events import EVENT_TOPICS
from app.services.chain_service import chain_service


client = TestClient(app)

LOCAL_ADDRESSES = {
    "mock_usdc_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "identity_registry_address": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "credit_score_registry_address": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    "lending_pool_address": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "loan_manager_address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    "recovery_manager_address": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    "dispute_manager_address": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
}
IDENTITY_REGISTRY = LOCAL_ADDRESSES["identity_registry_address"]
TX_HASH = "0x" + "ab" * 32
OTHER_TX_HASH = "0x" + "cd" * 32


def authenticate(wallet: str) -> dict[str, str]:
    nonce = client.post("/api/v1/auth/nonce", json={"wallet_address": wallet}).json()["nonce"]
    token = client.post(
        "/api/v1/auth/verify",
        json={"wallet_address": wallet, "nonce": nonce, "signature": f"demo:{nonce}"},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def register_profile(wallet: str) -> dict[str, str]:
    headers = authenticate(wallet)
    response = client.post(
        "/api/v1/borrowers/register", headers=headers, json={"display_name": "Chain Borrower"}
    )
    assert response.status_code == 201
    return headers


def wallet_topic(wallet: str) -> str:
    return "0x" + wallet.lower().removeprefix("0x").rjust(64, "0")


def make_receipt(
    wallet: str,
    *,
    status: str = "0x1",
    address: str = IDENTITY_REGISTRY,
    topic: str = EVENT_TOPICS["IdentityRegistry.IdentityRegistered"],
    block: int = 10,
) -> dict[str, Any]:
    return {
        "transactionHash": TX_HASH,
        "status": status,
        "blockNumber": hex(block),
        "to": IDENTITY_REGISTRY,
        "logs": [
            {
                "address": address,
                "topics": [topic, wallet_topic(wallet), "0x" + "11" * 32],
                "logIndex": "0x0",
                "removed": False,
            }
        ],
    }


@pytest.fixture
def configured_chain(monkeypatch: pytest.MonkeyPatch) -> Iterator[Settings]:
    settings = get_settings()
    monkeypatch.setattr(settings, "sepolia_rpc_url", "http://rpc.test")
    monkeypatch.setattr(settings, "chain_id", 31337)
    for key, value in LOCAL_ADDRESSES.items():
        monkeypatch.setattr(settings, key, value)
    yield settings
    chain_service.transport = None


def mock_rpc(
    receipt: dict[str, Any] | None, *, chain_id: int = 31337, latest_block: int = 12
) -> Callable[[httpx.Request], httpx.Response]:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        results = {
            "eth_chainId": hex(chain_id),
            "eth_getTransactionReceipt": receipt,
            "eth_blockNumber": hex(latest_block),
        }
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": results[body["method"]]})

    chain_service.transport = httpx.MockTransport(handler)
    return handler


def sync(headers: dict[str, str], transaction_hash: str = TX_HASH) -> httpx.Response:
    return client.post(
        "/api/v1/borrowers/me/identity/sync",
        headers=headers,
        json={"transaction_hash": transaction_hash},
    )


def test_chain_config_reports_demo_defaults_without_exposing_rpc_url() -> None:
    response = client.get("/api/v1/chain/config")

    assert response.status_code == 200
    body = response.json()
    assert body["demo_mode"] is True
    assert body["contracts_configured"] is False
    assert body["rpc_configured"] is False
    assert set(body["contracts"]) == {
        "mock_usdc",
        "identity_registry",
        "credit_score_registry",
        "lending_pool",
        "loan_manager",
        "recovery_manager",
        "dispute_manager",
    }
    assert "rpc" not in json.dumps(body).replace("rpc_configured", "")


def test_chain_config_reports_configured_local_network(configured_chain: Settings) -> None:
    body = client.get("/api/v1/chain/config").json()

    assert body["network"] == "hardhat-local"
    assert body["chain_id"] == 31337
    assert body["rpc_configured"] is True
    assert body["contracts_configured"] is True
    assert body["contracts"]["identity_registry"] == IDENTITY_REGISTRY
    assert "rpc.test" not in json.dumps(body)


def test_identity_sync_requires_chain_configuration() -> None:
    headers = register_profile("0x0000000000000000000000000000000000000040")
    response = sync(headers)

    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_identity_sync_marks_profile_registered_from_verified_receipt(configured_chain: Settings) -> None:
    wallet = "0x0000000000000000000000000000000000000041"
    headers = register_profile(wallet)
    mock_rpc(make_receipt(wallet))

    response = sync(headers)

    assert response.status_code == 200
    assert response.json()["identity_status"] == "registered"
    assert response.json()["registration_transaction_hash"] == TX_HASH
    profile = client.get("/api/v1/borrowers/me", headers=headers).json()
    assert profile["registration_transaction_hash"] == TX_HASH


def test_identity_sync_is_idempotent_and_rejects_a_different_hash(configured_chain: Settings) -> None:
    wallet = "0x0000000000000000000000000000000000000042"
    headers = register_profile(wallet)
    mock_rpc(make_receipt(wallet))

    assert sync(headers).status_code == 200
    assert sync(headers).status_code == 200
    conflict = sync(headers, OTHER_TX_HASH)
    assert conflict.status_code == 409


def test_identity_sync_keeps_pending_transactions_pending(configured_chain: Settings) -> None:
    wallet = "0x0000000000000000000000000000000000000043"
    headers = register_profile(wallet)
    mock_rpc(None)

    response = sync(headers)

    assert response.status_code == 409
    assert "pending" in response.json()["detail"]
    assert client.get("/api/v1/borrowers/me", headers=headers).json()["identity_status"] == "pending"


def test_identity_sync_waits_for_required_confirmations(
    configured_chain: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    wallet = "0x0000000000000000000000000000000000000044"
    headers = register_profile(wallet)
    monkeypatch.setattr(configured_chain, "chain_confirmations", 3)
    mock_rpc(make_receipt(wallet, block=10), latest_block=11)

    response = sync(headers)

    assert response.status_code == 409
    assert "2 of 3" in response.json()["detail"]


@pytest.mark.parametrize(
    ("wallet", "receipt_overrides", "message"),
    [
        ("0x0000000000000000000000000000000000000045", {"status": "0x0"}, "failed on-chain"),
        (
            "0x0000000000000000000000000000000000000145",
            {"address": "0x0000000000000000000000000000000000000bad"},
            "expected",
        ),
        ("0x0000000000000000000000000000000000000245", {"topic": "0x" + "00" * 32}, "expected"),
    ],
)
def test_identity_sync_rejects_failed_or_mismatched_receipts(
    configured_chain: Settings, wallet: str, receipt_overrides: dict[str, str], message: str
) -> None:
    headers = register_profile(wallet)
    mock_rpc(make_receipt(wallet, **receipt_overrides))

    response = sync(headers)

    assert response.status_code == 422
    assert message in response.json()["detail"]
    assert client.get("/api/v1/borrowers/me", headers=headers).json()["identity_status"] == "pending"


def test_identity_sync_rejects_an_event_for_another_wallet(configured_chain: Settings) -> None:
    wallet = "0x0000000000000000000000000000000000000046"
    headers = register_profile(wallet)
    mock_rpc(make_receipt("0x0000000000000000000000000000000000000047"))

    assert sync(headers).status_code == 422


def test_identity_sync_rejects_rpc_on_the_wrong_chain(configured_chain: Settings) -> None:
    wallet = "0x0000000000000000000000000000000000000048"
    headers = register_profile(wallet)
    mock_rpc(make_receipt(wallet), chain_id=1)

    response = sync(headers)

    assert response.status_code == 503
    assert "expected 31337" in response.json()["detail"]


def test_identity_sync_reports_rpc_outage_without_leaking_the_url(configured_chain: Settings) -> None:
    wallet = "0x0000000000000000000000000000000000000049"
    headers = register_profile(wallet)

    def unavailable(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    chain_service.transport = httpx.MockTransport(unavailable)
    response = sync(headers)

    assert response.status_code == 503
    assert "rpc.test" not in response.json()["detail"]


def test_identity_sync_validates_the_transaction_hash_format() -> None:
    headers = register_profile("0x000000000000000000000000000000000000004a")
    assert sync(headers, "0x1234").status_code == 422


def test_identity_sync_requires_a_profile(configured_chain: Settings) -> None:
    headers = authenticate("0x000000000000000000000000000000000000004b")
    assert sync(headers).status_code == 404


def production_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "demo_mode": False,
        "database_url": "postgresql+asyncpg://rebound:secret@localhost/rebound",
        "jwt_secret": "a-production-grade-secret-value",
        "sepolia_rpc_url": "https://sepolia.example/rpc",
        **LOCAL_ADDRESSES,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_production_configuration_requires_rpc_and_contract_addresses() -> None:
    production_settings().validate_production_configuration()

    with pytest.raises(RuntimeError, match="SEPOLIA_RPC_URL"):
        production_settings(sepolia_rpc_url="").validate_production_configuration()
    with pytest.raises(RuntimeError, match="LENDING_POOL_ADDRESS, LOAN_MANAGER_ADDRESS"):
        production_settings(
            lending_pool_address="", loan_manager_address="0x123"
        ).validate_production_configuration()
    with pytest.raises(RuntimeError, match="CHAIN_ID 1"):
        production_settings(chain_id=1).validate_production_configuration()
