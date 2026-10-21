# AI Product Advisor Phase 2 baseline audit

Date: 2026-10-21

## Baseline identity

- Branch: `main`.
- Baseline HEAD: `3c88ba955c897c274445ae491b621c7b27dd1f38`.
- Baseline worktree: clean and synchronized with `origin/main` (`ahead=0`, `behind=0`).
- Northflank API build `certain-lamp-9701`, deployment `6ad880cdabde8cae3cca82f5`.
- Northflank AI build `proud-class-190`, deployment `6ad880cb58a3257dcb2ceb45`.
- Cloudflare Storefront version `f851b777-6f89-4edc-9ff8-ada2a8a665fb` and Admin version
  `775e97bb-3ad0-4a90-894a-089bec6886a8` were current at baseline inspection.
- GitHub CI run `39574399332` and staging Firefox run `39574954737` passed for the
  baseline commit.

These deployment identifiers describe the baseline only. Uncommitted Phase 6 source is not
represented by those deployed revisions.

## Architecture verified in source

The read-only path remains:

`Storefront -> NestJS AI Gateway -> FastAPI/Pydantic AI -> signed NestJS Tool Gateway -> Catalog`

- NestJS owns conversation ownership, Origin policy, rate limiting and public product hydration.
- FastAPI accepts only HMAC-bound internal requests and exposes three fixed read-only tools.
- FastAPI has no MongoDB/Mongoose package, database URI setting or direct database client.
- No Agent tool mutates Cart, Checkout, Order, Payment, inventory, role or customer data.
- Product slugs returned by an Agent must exist in the current run's authoritative tool observations.

## Locked versions inspected

| Runtime/package              | Version   |
| ---------------------------- | --------- |
| Node.js                      | `22.23.2` |
| pnpm                         | `10.34.3` |
| AI Python runtime through uv | `3.13.15` |
| FastAPI                      | `0.142.2` |
| Pydantic                     | `2.13.5`  |
| pydantic-settings            | `2.15.0`  |
| pydantic-ai-slim             | `2.57.0`  |
| google-genai                 | `2.31.0`  |
| groq                         | `1.7.0`   |
| Next.js                      | `16.4.2`  |
| React                        | `19.3.0`  |
| NestJS                       | `12.1.2`  |
| Playwright                   | `1.64.0`  |

## Unmodified baseline gates

| Command                                                  | Result                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                         | pass; ignored-build-script warning preserved                                   |
| `pnpm format:check`                                      | pass                                                                           |
| `pnpm lint`                                              | pass                                                                           |
| `pnpm typecheck`                                         | pass                                                                           |
| `pnpm --filter @farta/api test`                          | 20 files / 92 tests passed                                                     |
| `pnpm --filter @farta/storefront test`                   | 15 files / 47 tests passed                                                     |
| `pnpm --filter @farta/admin test`                        | 5 files / 14 tests passed                                                      |
| `uv sync --frozen`                                       | pass                                                                           |
| `uv run ruff check .` and `uv run ruff format --check .` | pass                                                                           |
| `uv run pytest`                                          | 25 tests passed                                                                |
| `pnpm test:e2e` with `pnpm infra:up`                     | 7 files / 65 tests passed; infrastructure removed afterward                    |
| `pnpm build`                                             | pass; local sitemap logged unavailable API content because API was not running |
| `pnpm audit:prod`                                        | no known production dependency vulnerability reported                          |

## Baseline gaps

- Gemini and Groq were provider-off; no live model-quality, token, quota or provider-latency evidence.
- Existing evaluation repeated 10 router cases to 200 iterations and did not evaluate Agent quality.
- AI logs lacked a complete, safe event vocabulary and provider/tool duration hooks.
- Inbound FastAPI nonce replay cache is process-local. Multi-replica AI deployment remains blocked
  until a shared replay claim or equivalent single-ingress guarantee is approved.
- Alerts, email delivery, OAuth providers, SePay Test delivery, backup/restore and rollback remain
  external operational blockers from Phase 5.

## Evidence labels

- **IMPLEMENTED / LOCAL VERIFIED:** architecture and commands above.
- **CI VERIFIED:** baseline GitHub runs listed above.
- **STAGING VERIFIED:** provider-off baseline revisions only.
- **BLOCKED:** live LLM provider and all external operational boundaries listed above.
