from fastapi import APIRouter

from app.config import ADDRESS_PATTERN, get_settings
from app.schemas.chain import ChainConfigResponse


router = APIRouter(prefix="/chain")


@router.get("/config", response_model=ChainConfigResponse)
async def get_chain_config() -> ChainConfigResponse:
    """Public chain configuration. The RPC URL is never returned because it may embed a key."""
    settings = get_settings()
    return ChainConfigResponse(
        demo_mode=settings.demo_mode,
        chain_id=settings.chain_id,
        network=settings.network_name,  # type: ignore[arg-type]
        rpc_configured=bool(settings.sepolia_rpc_url),
        contracts_configured=settings.contracts_configured,
        confirmations=settings.chain_confirmations,
        contracts={
            name: address if ADDRESS_PATTERN.fullmatch(address) else None
            for name, address in settings.contract_addresses().items()
        },
    )
