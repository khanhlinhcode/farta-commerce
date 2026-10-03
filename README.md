# FARTA Commerce

Greenfield production-oriented fashion-commerce monorepo. Phase 0 architecture is approved; Phase 1 provides reproducible application shells, local infrastructure and the executable authentication/session/RBAC/CSRF foundation. Commerce domains are not implemented yet, and the repository is **not production-ready**.

## Stack baseline (verified 2026-10-03)

- Node.js 22.23.2, pnpm 10.34.3, TypeScript 5.9.3
- Next.js 16.3.8 / React 19.3.0
- Vite 8.3.2 / React 19.3.0
- NestJS 12.1.2, MongoDB/Mongoose, Redis/ioredis
- Python 3.12–3.14, FastAPI 0.142.2

Next.js 16 requires Node.js 20.9+; NestJS 12 CommonJS consumption requires Node 20.19+ or 22.12+ on the Node 22 line. The repository pins Node 22.23.2. TypeScript stays on 5.9.3 because the selected lint toolchain currently declares support below 6.1.

## Start

```bash
cp .env.example apps/api/.env
cp apps/storefront/.env.example apps/storefront/.env.local
cp apps/admin/.env.example apps/admin/.env.local
corepack enable
pnpm install --frozen-lockfile
pnpm infra:up
pnpm dev
```

Run the AI service separately:

```bash
cd apps/ai-service
uv sync --frozen
uv run uvicorn app.main:app --reload --port 8000
```

Default local ports: storefront `3000`, API `4000`, admin `5173`, AI service `8000`, MongoDB `27017`, Redis `6379`.

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm audit:prod
cd apps/ai-service && uv run ruff check . && uv run pytest
```

## Architecture and security

Start with [`docs/phase-0/README.md`](docs/phase-0/README.md). Important decisions are under `docs/adr/`; the current design threat model is `docs/security/threat-model.md`.

Authentication routes and exact cookie/CSRF behavior are documented in [`docs/api/authentication.md`](docs/api/authentication.md). To create a development OWNER, set the three blank `BOOTSTRAP_OWNER_*` variables locally and run `pnpm --filter @farta/api bootstrap:owner`; the command refuses staging/production and never has a default password.

Secrets belong in local ignored files or the deployment secret store. Never expose provider/database credentials through `NEXT_PUBLIC_*` or `VITE_*` variables. Production configuration must fail closed and must not use `.env.example` placeholders.

## Troubleshooting

- Node engine error: use the version in `.nvmrc`.
- API configuration error: confirm `apps/api/.env` exists and contains no production placeholders outside development.
- Mongo readiness failure: ensure Docker is running and `pnpm infra:up` reports healthy services.
- Replica-set transaction failure: inspect the one-shot `mongo-init` service; Compose initializes it automatically.
- Port collision: change local-only ports consistently in `.env` and proxy configuration.
