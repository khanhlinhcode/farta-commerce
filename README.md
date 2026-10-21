# FARTA Commerce

Greenfield production-oriented fashion-commerce monorepo. Phase 0 architecture is approved; Phase 1 provides the executable security foundation; Phase 2 provides catalog and inventory; Phase 3 provides the premium storefront; Phase 4A provides the server-authoritative Cart; Phase 4B provides atomic Checkout, Reservations, immutable Orders and COD; Phase 4C adds the SePay/VietQR payment boundary and verified bank webhooks; Phase 4D adds permissioned Admin order operations, inventory sale/cancellation workflows, reservation expiry and a notification outbox. Phase 4.1 adds local runtime stabilization, an idempotent development catalog seed, browser release coverage and feature-oriented Admin modules. Phase 5B deploys and validates the Chromium staging commerce path. Phase 5C adds custom staging domains. Phase 5D validates a targeted Cloudflare Worker-capacity remediation candidate. The repository is **not production-ready**: real SePay Test-mode delivery, OAuth adapters, notification delivery, alerting, physical-device evidence and a sustained capacity decision remain gated work.

## Current status

| Scope                                               | Status                                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Local commerce implementation and automated gates   | Implemented                                                                                   |
| Development Cloudinary-backed catalog seed          | Implemented; environment-specific manifest required                                           |
| Chromium/WebKit Storefront/Admin browser coverage   | Candidate passed 31/31 Chromium and 27/27 WebKit; sustained Free-plan capacity remains a risk |
| CI browser lane                                     | Deferred until approved non-production media bootstrap exists                                 |
| Release remediation                                 | Phase 5D candidate validated; commit/redeploy evidence pending                                |
| Staging deployment and external-provider validation | Custom domains deployed; provider/capacity gates remain blocked                               |
| Controlled AI shopping assistant                    | Deterministic provider-off path deployed and validated                                        |

## Stack baseline (verified 2026-10-20)

- Node.js 22.23.2, pnpm 10.34.3, TypeScript 5.9.3
- Next.js 16.4.2 / React 19.3.0
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

The Product Advisor is fail-closed by default. Keep `AI_ENABLED=false` until
`AI_GATEWAY_SHARED_SECRET`, `AI_TOOLS_SHARED_SECRET` and
`AI_CONVERSATION_SECRET` are generated independently and configured in both the
appropriate API/AI-service environments. Gemini and Groq have separate enable and
free-tier-verification flags; a public pricing page is not sufficient evidence to
turn either provider on. See [`docs/api/ai-agent.md`](docs/api/ai-agent.md).

The staging gateway currently enables only the deterministic provider-off
Product Advisor. Gemini and Groq remain disabled. Custom-domain cutover evidence
is recorded in
[`docs/phase-5/custom-domain-and-ai-staging-cutover.md`](docs/phase-5/custom-domain-and-ai-staging-cutover.md).
The current Worker remediation evidence is in
[`docs/phase-5/worker-capacity-remediation.md`](docs/phase-5/worker-capacity-remediation.md).

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

### Browser release coverage

Browser coverage is pinned to `@playwright/test` 1.64.0. Chromium remains the default; the runner also accepts `E2E_BROWSERS=firefox`, `webkit`, or a comma-separated combination. After the development Cloudinary media manifest and catalog seed are available, install the matching browser once and provide an existing local STAFF/OWNER account through the process environment:

```bash
pnpm test:browser:install
E2E_STAFF_EMAIL=<development-staff-email> \
E2E_STAFF_PASSWORD=<development-staff-password> \
pnpm test:browser
```

For local-only use, the same `E2E_STAFF_EMAIL` and `E2E_STAFF_PASSWORD` values may instead be stored in the ignored `apps/api/.env`. They are loaded only by the Playwright runner and are filtered out of the API, Storefront and Admin child-process environments. Use a development-only account; never place production credentials in this file or commit them.

`test:browser` reruns the idempotent development seed before Playwright. It starts API, Storefront and Admin through the checked-in `webServer` configuration, uses one browser worker, and never embeds credentials in source or snapshots. Update reviewed Chromium visual baselines only with `pnpm test:browser:update`.

Current deployed staging evidence and current remediation limits are recorded under
[`docs/phase-5/`](docs/phase-5/), especially
[`worker-capacity-remediation.md`](docs/phase-5/worker-capacity-remediation.md).

The CI browser lane is intentionally not enabled yet: a fresh CI MongoDB cannot reproduce the real Cloudinary-backed seed from the ignored environment-specific media manifest alone. A dedicated non-production Cloudinary account and an approved MediaAsset bootstrap/finalization mechanism are required first; CI must not substitute fake media or production provider credentials.

## Architecture and security

Start with [`docs/phase-0/README.md`](docs/phase-0/README.md). Important decisions are under `docs/adr/`; the current design threat model is `docs/security/threat-model.md`.

Authentication routes and exact cookie/CSRF behavior are documented in [`docs/api/authentication.md`](docs/api/authentication.md). To create a development OWNER, set the three blank `BOOTSTRAP_OWNER_*` variables locally and run `pnpm --filter @farta/api bootstrap:owner`; the command refuses staging/production and never has a default password.

For an idempotent local catalog, first finalize the approved development images through the authenticated Admin Cloudinary flow and place their non-secret `MediaAsset` mapping in the ignored `apps/api/.development-seed-media.json` manifest. Set `DEVELOPMENT_SEED_ACTOR_EMAIL` to an existing active development OWNER, then run:

```bash
pnpm --filter @farta/api seed:development
```

The command accepts only `APP_ENV=development`; it never seeds staging/production, never creates credentials, never deletes local business data and initializes stock only when a seed-owned variant is still empty. See [`docs/phase-4/development-seed-report.md`](docs/phase-4/development-seed-report.md).

Catalog endpoints, publication invariants, money representation and Cloudinary finalization are documented in [`docs/api/catalog.md`](docs/api/catalog.md), [`docs/architecture/catalog-inventory.md`](docs/architecture/catalog-inventory.md) and [`docs/architecture/cloudinary-phase-2.md`](docs/architecture/cloudinary-phase-2.md).

The Phase 3 storefront architecture, reviews and completion evidence are under [`docs/phase-3/`](docs/phase-3/). Public catalog reads use a 60-second revalidation window. Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS storefront URL and explicitly set `NEXT_PUBLIC_INDEXABLE=true` only for production environments that should be indexed. Staging and development remain `noindex` by default.

Cart endpoints and configuration are documented in [`docs/api/cart.md`](docs/api/cart.md) and [`docs/architecture/cart.md`](docs/architecture/cart.md). Checkout and order contracts are documented in [`docs/api/checkout-orders.md`](docs/api/checkout-orders.md) and [`docs/architecture/checkout-orders.md`](docs/architecture/checkout-orders.md). Supply every independent secret, retention, shipping and rate-limit value shown in `.env.example`; production has no implicit values for these business/security settings.

Phase 4B supports real guest/customer checkout, order confirmation, account order history/detail and verified guest lookup. COD remains `UNPAID` until an authorized collection command records it after delivery. When explicitly configured, Phase 4C supports full/deposit SePay bank transfers, server-generated VietQR instructions, authenticated raw-body webhooks and explicit payment conflicts. Local tests use signed provider-shaped payloads only; they are not evidence of a real SePay account or money movement.

Phase 4D implements Admin order list/detail, permissioned fulfillment transitions, controlled cancellation, manual refund reconciliation records, delivered-order COD collection, audit history, transactional notification intent and the idempotent reservation worker. Start that separately with:

```bash
pnpm --filter @farta/api worker:reservations
```

For a watch-mode development worker that uses the same compiled CommonJS path as the API:

```bash
pnpm --filter @farta/api worker:reservations:dev
```

No notification provider is configured; outbox events remain `PENDING`. Manual refund reconciliation records an external refund reference and never pretends that a provider refund occurred. Wishlist, password recovery and OAuth success remain unavailable rather than simulated.

Customer profile editing and first-login onboarding completion are now real session/CSRF-protected API workflows. Password recovery remains a release blocker until the recovery/outbox schema evolution and transactional email boundary are approved; see [`docs/remediation/account-recovery-security-review.md`](docs/remediation/account-recovery-security-review.md). The current remediation evidence and browser-host limitation are under [`docs/remediation/`](docs/remediation/).

The Admin entrypoint is intentionally thin. Feature pages, schemas and tests live under `apps/admin/src/features/`; shared authenticated API transport remains under `apps/admin/src/lib/`. This organization does not change backend permissions or commerce state machines.

Secrets belong in local ignored files or the deployment secret store. Never expose provider/database credentials through `NEXT_PUBLIC_*` or `VITE_*` variables. Production configuration must fail closed and must not use `.env.example` placeholders.

`staging` and `production` are both deployed environments: they require HTTPS origins, Secure protected cookies, reviewed HTTP security headers, operational log verbosity and HTTPS AI-to-API routing. Development and test retain local HTTP behavior. These defaults are locally tested; proxy hops, TLS termination and cookie delivery still require validation against the selected staging topology.

## Troubleshooting

- Node engine error: use the version in `.nvmrc`.
- API configuration error: confirm `apps/api/.env` exists and contains no production placeholders outside development.
- Mongo readiness failure: ensure Docker is running and `pnpm infra:up` reports healthy services.
- Replica-set transaction failure: inspect the one-shot `mongo-init` service; Compose initializes it automatically.
- Local MongoDB uses `127.0.0.1` plus `directConnection=true`; this keeps single-node replica-set transactions available without following Docker's internal-only `mongodb` hostname. Do not copy this development behavior into a managed production replica-set URI.
- Port collision: change local-only ports consistently in `.env` and proxy configuration.
- Browser seed failure: confirm `APP_ENV=development`, `DEVELOPMENT_SEED_ACTOR_EMAIL`, the ignored finalized-media manifest and its matching local `MediaAsset` records exist before running Playwright.
