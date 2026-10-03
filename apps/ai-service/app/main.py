from fastapi import FastAPI

from app.config import get_settings

settings = get_settings()
app = FastAPI(
    title="FARTA AI Service",
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
)


@app.get("/health/live", tags=["health"])
def liveness() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def readiness() -> dict[str, str]:
    # No external AI/provider dependency exists in Phase 1.
    return {"status": "ok"}
