# Phase 4.1A/B Runtime and CI Stabilization Report

Date: 2026-10-11
Baseline: `01847616d0a470013a2e2aa4d0ade13638f67591` (`feat: complete transactional commerce operations`)

## Scope and outcome

This phase stabilizes the existing Phase 1–4 implementation. It does not change Cart, Checkout, Inventory, Order or Payment business invariants and does not claim staging or production readiness.

Local runtime, the CommonJS worker development path, MongoDB/Redis-backed CI E2E setup and full-history secret scanning are repaired. No production dependency was added, removed, upgraded or downgraded.

## Reproduced failures and root causes

1. `pnpm dev` compiled the API but port `4000` never listened. The single-node replica set advertised the Compose-only hostname `mongodb`; the host process could connect to the published port but could not resolve the discovered member hostname. A process-only URI override using `127.0.0.1` and `directConnection=true` made live and ready return HTTP 200.
2. `pnpm --filter @farta/api worker:reservations:dev` failed through `tsx` with `Cannot set property nextConnectionId of #<Mongoose> which has only a getter`. The minimal reproduction showed that `import * as mongoose` under this ESM execution path exposes `nextConnectionId` as a getter-only module namespace property, while Mongoose 9.10.4 mutates it in `createConnection()`. The installed metadata permits Mongoose 9 (`@nestjs/mongoose` 12.0.0 peer range `^7 || ^8 || ^9`), so this was treated as an execution-mode interop defect, not evidence for a version change.
3. The built CommonJS worker started successfully, confirming that the worker/domain code itself was not the cause.
4. GitHub Actions run [37767465978](https://github.com/khanhlinhcode/farta-commerce/actions/runs/37767465978) had no MongoDB/Redis startup before API E2E. Six database-backed suites could not initialize.
5. The same run's Gitleaks 8.24.3 invocation constructed `e43c18...^..0184761...`; `e43c18...` was the repository root, so the parent revision did not exist. Gitleaks reported a partial zero-byte scan and exited with an error.
6. During final local validation, the concurrent-registration E2E intermittently returned two HTTP 201 responses after another suite had dropped the database. The test did not explicitly wait for the unique indexes to be rebuilt. It now synchronizes model indexes before exercising the race, matching the other database-backed E2E suites.

## Changes

- `.env.example` uses the host-resolvable `127.0.0.1` single-node replica-set URI with `directConnection=true`.
- `DatabaseModule` applies `directConnection=true` only for `development`; staging, test and production do not inherit that behavior. Unit coverage verifies the boundary.
- `apps/api/scripts/dev.mjs` now compiles through the API's CommonJS TypeScript configuration and supervises either the API or a validated compiled worker entry point.
- `worker:reservations:dev` uses that CommonJS path instead of executing decorated NestJS/Mongoose code through `tsx`.
- The reservation worker uses interruptible waiting and logs shutdown request/completion.
- CI separates static/unit/build checks from MongoDB/Redis-backed E2E. The E2E job starts the pinned Compose services, runs replica-set initialization, waits for health through `infra:up`, and always stops containers without deleting volumes.
- Gitleaks Action is pinned to v3.0.0 commit `e0c47f4...` and installs Gitleaks 8.24.3. Its event scan is bound to a known commit to avoid the root-parent bug; the authoritative next step runs `gitleaks git --log-opts="--all"` over complete fetched history.
- GitHub-hosted CI actions use their official Node 24 releases and immutable commit SHAs: `actions/checkout` v6.1.0, `actions/setup-node` v6.5.0 and `pnpm/action-setup` v5.0.0.
- `.gitleaks.toml` extends the default rules and allowlists only three exact, public placeholder assignments in `.env.example`. It does not allowlist the whole file or suppress arbitrary values.

## Local evidence

Environment:

- Node.js `v22.23.2`
- pnpm `10.34.3`
- Docker Engine `29.7.2`
- MongoDB `mongo:7.0.41-jammy`: healthy
- Redis `redis:8.2-alpine`: healthy
- Python through uv: `3.13.15`

Runtime evidence after the fix:

- `pnpm infra:up`: MongoDB and Redis healthy; `mongo-init` returned replica-set status `1`.
- `pnpm dev`: API, Storefront and Admin started without a process-level MongoDB override.
- API live, ready, categories, products and guest Cart: HTTP 200.
- Storefront Home, Shop, Cart, Checkout and Order Lookup: HTTP 200.
- Admin root: HTTP 200; unauthenticated Admin Orders: HTTP 401.
- AI live and ready: HTTP 200.
- Built and development reservation workers emitted the startup log. A direct SIGTERM produced both `shutdown requested` and `stopped`; the empty batch completed without mutation.
- API E2E transactions passed, including rollback, idempotency, reservation expiry and the 100-way last-unit checkout assertion (1 HTTP 201 and 99 HTTP 409).

Quality gates executed after implementation:

| Gate                         | Result                           |
| ---------------------------- | -------------------------------- |
| Frozen install               | pass                             |
| Format                       | pass                             |
| Lint                         | pass                             |
| Typecheck                    | pass                             |
| API unit                     | 13 files, 50 tests passed        |
| Storefront unit/component    | 6 files, 18 tests passed         |
| Admin component              | 1 file, 2 tests passed           |
| API E2E/security/concurrency | 7 files, 64 tests passed         |
| Production builds            | API, Admin and Storefront passed |
| Production dependency audit  | no known vulnerabilities found   |
| Python uv frozen sync        | pass                             |
| Ruff                         | pass                             |
| Pytest                       | 2 tests passed                   |

The concurrent registration target was additionally executed twice after the index-readiness fix: 13/13 passed both times.

Local Gitleaks 8.24.3 first scanned 19 commits and approximately 1.36 MB, identifying three redacted placeholder false positives. After the narrow allowlist, the same full-history command scanned 19 commits/approximately 1.36 MB and reported no leaks. The downloaded Darwin ARM64 archive SHA-256 matched the official `v8.24.3` checksum (`b90f13bb...9013`).

## CI evidence

The pre-fix failure is [GitHub Actions run 37767465978](https://github.com/khanhlinhcode/farta-commerce/actions/runs/37767465978).

Initial validation branch run: [38152700801](https://github.com/khanhlinhcode/farta-commerce/actions/runs/38152700801) — all four jobs passed; it exposed Node 20 action-runtime deprecation warnings that were then removed by pinning the official Node 24 action releases.

Final validation branch run: [38152848954](https://github.com/khanhlinhcode/farta-commerce/actions/runs/38152848954) — `node-quality`, `api-e2e`, `python-quality` and `secret-scan` all passed with the pinned Node 24 action releases. The only later branch change was this report URL.

## Source and dependency decisions

Sources checked on 2026-10-11:

- [Gitleaks official CLI README at v8.24.3](https://github.com/gitleaks/gitleaks/blob/v8.24.3/README.md): `git` scans repository history and accepts Git log options through `--log-opts`.
- [Gitleaks Action official README](https://github.com/gitleaks/gitleaks-action): v3 moves from Node 20 to Node 24; its inputs/behavior remain compatible with v2.
- Official action metadata for `actions/checkout` v6.1.0, `actions/setup-node` v6.5.0 and `pnpm/action-setup` v5.0.0 declares the Node 24 runtime used by GitHub-hosted runners.
- Installed package metadata: `@nestjs/mongoose` 12.0.0 is ESM and declares Mongoose 7/8/9 peers; Mongoose 9.10.4 is CommonJS; `tsx` is 4.23.15. No package version was changed.

## Remaining limitations

- This validates local and GitHub-hosted CI behavior only. It is not staging/provider/deployment evidence.
- MongoDB and Redis remain running locally after validation; no Docker volume was deleted.
- Real SePay Test-mode, OAuth, Cloudinary, email delivery, production worker supervision and monitoring remain outside this stabilization phase.
- Phase 4.1C browser automation remains gated on stakeholder approval if Playwright or another browser dependency must be added.
