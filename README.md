# FARTA Commerce

Greenfield production-oriented fashion-commerce monorepo. Phase 0 architecture is approved; Phase 1 provides the executable security foundation; Phase 2 provides the catalog, variant, inventory-ledger, media and banner domains plus the protected Admin catalog workspace; Phase 3 provides the premium storefront over those real APIs; Phase 4A provides the server-authoritative guest/customer Cart and merge flow. The repository is **not production-ready**: Checkout, Orders, production provider configuration and deployment validation remain gated work.

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

Catalog endpoints, publication invariants, money representation and Cloudinary finalization are documented in [`docs/api/catalog.md`](docs/api/catalog.md), [`docs/architecture/catalog-inventory.md`](docs/architecture/catalog-inventory.md) and [`docs/architecture/cloudinary-phase-2.md`](docs/architecture/cloudinary-phase-2.md).

The Phase 3 storefront architecture, reviews and completion evidence are under [`docs/phase-3/`](docs/phase-3/). Public catalog reads use a 60-second revalidation window. Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS storefront URL and explicitly set `NEXT_PUBLIC_INDEXABLE=true` only for production environments that should be indexed. Staging and development remain `noindex` by default.

Cart endpoints and configuration are documented in [`docs/api/cart.md`](docs/api/cart.md) and [`docs/architecture/cart.md`](docs/architecture/cart.md). Supply the independent cart credential secret, line limit, retention and rate-limit values shown in `.env.example`; production has no implicit values for these business/security settings.

Phase 4A deliberately stops before Checkout and Orders. The real Cart page and PDP Add to Cart are enabled, while its checkout action is an honest disabled Phase 4B boundary. Wishlist, password recovery and OAuth success remain unavailable rather than simulated.

Secrets belong in local ignored files or the deployment secret store. Never expose provider/database credentials through `NEXT_PUBLIC_*` or `VITE_*` variables. Production configuration must fail closed and must not use `.env.example` placeholders.

## Troubleshooting

- Node engine error: use the version in `.nvmrc`.
- API configuration error: confirm `apps/api/.env` exists and contains no production placeholders outside development.
- Mongo readiness failure: ensure Docker is running and `pnpm infra:up` reports healthy services.
- Replica-set transaction failure: inspect the one-shot `mongo-init` service; Compose initializes it automatically.
- Local MongoDB connection waiting indefinitely: on hosts where `localhost` resolves to an unreachable IPv6 listener, use `mongodb://127.0.0.1:27017/farta?replicaSet=rs0&directConnection=true` locally.
- Port collision: change local-only ports consistently in `.env` and proxy configuration.
