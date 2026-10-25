# FARTA AI service

Private FastAPI/Pydantic AI service for the read-only FARTA Product Advisor. A deterministic router
rejects unsupported/private intents and requests clarification, but every supported product request
is executed by Pydantic AI with typed output and an allowlisted read tool. Every tool
call returns through the authenticated NestJS Tool Gateway; this service has no direct MongoDB,
Cloudinary, Cart, Order, Payment or role-mutation access. Redis is limited to shared replay claims
and the bounded provider-request budget.

Provider-off mode fails closed for all supported requests. The approved Gemini model is
`gemini-3.5-flash-lite`; Groq remains disabled. Both providers require explicit enablement,
free-tier verification and secrets supplied through the deployment secret manager. Automatic
provider fallback and retries are rejected. LangGraph, LlamaIndex, production semantic retrieval
and commerce mutations remain out of scope. Local P2-D adds a fourth `search_knowledge` tool behind
`AI_RAG_ENABLED`; the flag defaults off and is rejected in staging/production. Retrieved content is
untrusted data, the model may return citation IDs only, and NestJS rehydrates active public citation
metadata before it reaches the browser.

```bash
uv sync --frozen
uv run uvicorn app.main:app --reload --port 8000
uv run ruff check .
uv run ruff format --check .
uv run pytest
uv run python -m app.evaluation.agent_eval
uv run python -m app.evaluation.knowledge_eval
```

See [`docs/api/ai-agent.md`](../../docs/api/ai-agent.md) and
[`docs/ai/phase-2-completion-report.md`](../../docs/ai/phase-2-completion-report.md). Never put
provider keys or commerce credentials in tracked files.
