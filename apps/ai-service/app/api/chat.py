from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.agents.executor import AgentExecutor
from app.config import Settings, get_settings
from app.schemas.chat import InternalChatRequest, InternalChatResponse
from app.security import NonceReplayStore, RedisNonceReplayStore, verify_gateway_request
from app.tools.commerce_client import CommerceClient

router = APIRouter(prefix="/v1", tags=["agent"])
SettingsDependency = Annotated[Settings, Depends(get_settings)]


def get_replay_store(settings: SettingsDependency) -> NonceReplayStore:
    return RedisNonceReplayStore(
        redis_url=settings.provider_budget_redis_url.get_secret_value(),
        environment=settings.app_env,
    )


async def require_gateway(
    request: Request,
    settings: SettingsDependency,
    replay_store: Annotated[NonceReplayStore, Depends(get_replay_store)],
) -> None:
    await verify_gateway_request(request, settings, replay_store)


@router.post("/chat", response_model=InternalChatResponse, dependencies=[Depends(require_gateway)])
async def chat(
    payload: InternalChatRequest,
    settings: SettingsDependency,
) -> InternalChatResponse:
    executor = AgentExecutor(settings, CommerceClient(settings))
    return await executor.execute(payload)
