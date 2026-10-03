# FARTA AI service

FastAPI scaffold only. It exposes health endpoints and validates configuration. It intentionally has no LangGraph, LlamaIndex, smolagents, MongoDB, Redis, Cloudinary or payment dependency yet.

Future inference must call authenticated, allowlisted NestJS API tools. This service must never receive direct commerce database credentials.

```bash
uv sync --frozen
uv run uvicorn app.main:app --reload --port 8000
uv run ruff check .
uv run pytest
```
