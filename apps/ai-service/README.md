# FARTA AI service

Private FastAPI/Pydantic AI service for the read-only FARTA Product Advisor. It supports a
deterministic intent router, bounded typed Agent execution and three allowlisted catalog tools. Every
tool call returns through the authenticated NestJS Tool Gateway; this service has no direct MongoDB,
Redis, Cloudinary, Cart, Order, Payment or role-mutation access.

Provider-off mode is the default and validated path. Gemini and Groq require explicit enablement,
free-tier verification and secrets supplied through the deployment secret manager. Automatic
provider fallback is rejected. LangGraph, LlamaIndex, RAG and commerce mutations remain out of
scope.

```bash
uv sync --frozen
uv run uvicorn app.main:app --reload --port 8000
uv run ruff check .
uv run ruff format --check .
uv run pytest
uv run python -m app.evaluation.agent_eval
```

See [`docs/api/ai-agent.md`](../../docs/api/ai-agent.md) and
[`docs/ai/phase-2-completion-report.md`](../../docs/ai/phase-2-completion-report.md). Never put
provider keys or commerce credentials in tracked files.
