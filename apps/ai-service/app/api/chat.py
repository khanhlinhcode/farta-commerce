from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.agents.executor import AgentExecutor
from app.config import Settings, get_settings
from app.schemas.chat import InternalChatRequest, InternalChatResponse
from app.security import NonceReplayCache, verify_gateway_request
from app.tools.commerce_client import CommerceClient

router = APIRouter(prefix="/v1", tags=["agent"])
replay_cache = NonceReplayCache()
SettingsDependency = Annotated[Settings, Depends(get_settings)]


async def require_gateway(
    request: Request,
    settings: SettingsDependency,
) -> None:
    await verify_gateway_request(request, settings, replay_cache)


@router.post("/chat", response_model=InternalChatResponse, dependencies=[Depends(require_gateway)])
async def chat(
    payload: InternalChatRequest,
    settings: SettingsDependency,
) -> InternalChatResponse:
    executor = AgentExecutor(settings, CommerceClient(settings))
    return await executor.execute(payload)
