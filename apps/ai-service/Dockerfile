FROM python:3.12-slim-bookworm AS build

COPY --from=ghcr.io/astral-sh/uv:0.12.8 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_NO_DEV=1

WORKDIR /app

COPY apps/ai-service/pyproject.toml apps/ai-service/uv.lock ./
RUN uv sync --locked --no-install-project --no-editable

COPY apps/ai-service/app ./app

FROM python:3.12-slim-bookworm AS runtime

ENV PATH=/app/.venv/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

RUN groupadd --gid 10001 farta \
  && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin farta

WORKDIR /app

COPY --from=build --chown=farta:farta /app/.venv ./.venv
COPY --from=build --chown=farta:farta /app/app ./app

USER farta

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

