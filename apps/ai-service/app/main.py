from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.config import get_settings

settings = get_settings()
app = FastAPI(
    title="FARTA AI Service",
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
)
app.include_router(chat_router)


@app.get("/health/live", tags=["health"])
def liveness() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def readiness() -> dict[str, str]:
    return {"status": "ok"}
