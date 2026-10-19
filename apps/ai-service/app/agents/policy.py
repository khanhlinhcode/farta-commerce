from dataclasses import dataclass

from app.config import Settings


@dataclass(frozen=True)
class AgentPolicy:
    max_iterations: int
    max_tool_executions: int
    output_token_limit: int
    request_timeout_seconds: float
    llm_timeout_seconds: float

    @classmethod
    def from_settings(cls, settings: Settings) -> "AgentPolicy":
        return cls(
            max_iterations=settings.max_agent_iterations,
            max_tool_executions=settings.max_tool_executions,
            output_token_limit=settings.output_token_limit,
            request_timeout_seconds=settings.request_timeout_seconds,
            llm_timeout_seconds=settings.llm_timeout_seconds,
        )
