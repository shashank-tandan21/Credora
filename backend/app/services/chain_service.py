from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import get_settings
from app.services.chain_events import EVENT_TOPICS


@dataclass(frozen=True)
class VerifiedEvent:
    transaction_hash: str
    block_number: int
    log_index: int
    confirmations: int


class ChainService:
    """Read-only JSON-RPC client that confirms contract events from transaction receipts.

    A transaction is treated as confirmed only when its receipt exists on the configured
    chain, has status 1, carries the expected event emitted by the expected contract for
    the expected wallet, and has at least CHAIN_CONFIRMATIONS confirmations. The backend
    never signs or sends transactions and never handles private keys.
    """

    def __init__(self) -> None:
        # Overridable in tests with an httpx.MockTransport.
        self.transport: httpx.AsyncBaseTransport | None = None

    async def verify_event(
        self,
        transaction_hash: str,
        contract_address: str,
        event: str,
        indexed_wallet: str,
    ) -> VerifiedEvent:
        settings = get_settings()
        if not settings.chain_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Blockchain RPC and contract addresses are not configured.",
            )

        async with httpx.AsyncClient(
            transport=self.transport, timeout=settings.chain_rpc_timeout_seconds
        ) as client:
            chain_id = int(await self._rpc(client, "eth_chainId", []), 16)
            if chain_id != settings.chain_id:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"RPC is connected to chain {chain_id}, expected {settings.chain_id}.",
                )

            receipt = await self._rpc(client, "eth_getTransactionReceipt", [transaction_hash])
            if receipt is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Transaction is pending or unknown; no receipt is available yet.",
                )
            if receipt.get("status") != "0x1":
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Transaction failed on-chain (receipt status 0).",
                )

            log = self._find_event_log(receipt, contract_address, event, indexed_wallet)
            if log is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Receipt does not contain the expected {event} event for this wallet.",
                )

            block_number = int(receipt["blockNumber"], 16)
            latest_block = int(await self._rpc(client, "eth_blockNumber", []), 16)
            confirmations = latest_block - block_number + 1
            if confirmations < settings.chain_confirmations:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Transaction has {confirmations} of "
                        f"{settings.chain_confirmations} required confirmations."
                    ),
                )

        return VerifiedEvent(
            transaction_hash=transaction_hash.lower(),
            block_number=block_number,
            log_index=int(log["logIndex"], 16),
            confirmations=confirmations,
        )

    async def _rpc(self, client: httpx.AsyncClient, method: str, params: list[Any]) -> Any:
        settings = get_settings()
        try:
            response = await client.post(
                settings.sepolia_rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            # The RPC URL may embed an API key, so it is never included in the error.
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Blockchain RPC is unavailable.",
            ) from exc
        if "error" in payload:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Blockchain RPC rejected {method}.",
            )
        return payload.get("result")

    @staticmethod
    def _find_event_log(
        receipt: dict[str, Any], contract_address: str, event: str, indexed_wallet: str
    ) -> dict[str, Any] | None:
        topic = EVENT_TOPICS[event]
        wallet_topic = "0x" + indexed_wallet.lower().removeprefix("0x").rjust(64, "0")
        for log in receipt.get("logs", []):
            topics = [item.lower() for item in log.get("topics", [])]
            if (
                not log.get("removed", False)
                and log.get("address", "").lower() == contract_address.lower()
                and len(topics) > 1
                and topics[0] == topic
                and topics[1] == wallet_topic
            ):
                return log
        return None


chain_service = ChainService()
