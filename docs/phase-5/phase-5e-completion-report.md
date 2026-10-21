# Phase 5E — Completion report

Date: 2026-10-21

Phase execution verdict: **completed with explicit external blockers**.
Release recommendation: **REMEDIATION REQUIRED — REMAIN ON STAGING**.

This report separates implemented source, automated evidence, deployed runtime
evidence and provider evidence. It does not claim production readiness.

## A. Release synchronization and source changes

- The five-commit Phase 5D local baseline through `a8e47ad` was pushed to
  `origin/main` without rewriting history.
- GitHub CI run `39561658916` passed for exact SHA
  `a8e47adb0a2c652fb57d4f14c5b21092bb0030e5`.
- Added a manual Firefox staging lane using the existing Playwright 1.64.0 and
  GitHub-hosted Linux; no production dependency was added.
- Bounded responsive navigation, isolated BOLA browser ownership and the Admin
  status-badge locator were corrected without changing commerce invariants.
- No schema, Order/Payment state machine, DNS record, credential or production
  setting was changed.

Phase 5E source commits before this report:

- `9c0086d` — `ci: add staging Firefox release lane`;
- `8361e33` — `test: bound responsive staging navigation`;
- `5125611` — `test: isolate customer B browser session`.

## B. GitHub CI evidence

CI run `39566107108` passed for exact SHA
`51256118235a4e91d7e47f19c3103c9670b16009`:

| Job            | Job ID         | Result                                                   |
| -------------- | -------------- | -------------------------------------------------------- |
| Python quality | `119108640258` | success; Ruff pass, Pytest 25/25                         |
| API E2E        | `119108640591` | success; 7 files / 65 tests                              |
| Node quality   | `119108640610` | success; format/lint/typecheck/unit/build/audit          |
| Secret scan    | `119108640931` | success; event commit and full history reported no leaks |

Node-quality logs report Admin 5 files / 14 tests, API 20 / 92 and Storefront
15 / 47. The build and production dependency audit passed.

Firefox workflow `39566128658`, job `119108714932`, passed 27/27 on Linux for
the same exact SHA.

## C. Local quality evidence

| Command/scope                                      | Result                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                   | pass; 9 workspaces                                                                   |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck` | pass                                                                                 |
| API unit                                           | 20 files / 92 tests passed                                                           |
| Storefront unit                                    | all 15 files / 47 tests passed file-by-file; parallel host contention recorded below |
| Admin unit                                         | 5 files / 14 tests passed                                                            |
| `pnpm test:e2e`                                    | 7 files / 65 tests passed                                                            |
| `pnpm build`                                       | pass; optional local sitemap logged unavailable product page while local API was off |
| `pnpm audit:prod`                                  | no known vulnerabilities                                                             |
| `uv sync --frozen`                                 | 52 packages checked                                                                  |
| Ruff check/format                                  | pass; 25 Python files formatted                                                      |
| Pytest                                             | 25/25 passed                                                                         |

The exact local `pnpm --filter @farta/storefront test` command was not hidden:
while macOS `bird`/iCloud and WindowServer were consuming high CPU, two attempts
failed 3/47 and 7/47 on default five-second async timeouts. The failing files
passed individually without changing timeouts, and all 15 files / 47 tests then
passed in a strictly sequential file-by-file run. GitHub's isolated Linux
`node-quality` job independently passed the normal full command at 47/47. No
timeout was increased and no Storefront assertion was weakened.

The first local E2E attempt also failed preflight because Docker Desktop was
not running, then was stopped once Redis connection errors confirmed the
missing infrastructure. Docker Desktop was started, `pnpm infra:up` completed,
the unchanged `pnpm test:e2e` command passed 7 files / 65 tests, and
`pnpm infra:down` removed the temporary containers/network. The failed
preflight is not counted as a test pass.

## D. Deployed staging evidence

- Storefront, Admin, API live and API ready returned HTTPS 200.
- The private AI live/ready endpoints returned 200 from the API runtime network.
- Storefront `robots.txt` remains `User-Agent: *` plus `Disallow: /`.
- Trusted Storefront CORS is echoed; an untrusted origin receives no allow
  origin. Browser tests validate CSP, CSRF and secure guest/session cookies.
- Northflank API build `tenacious-grape-2973` succeeded for exact SHA
  `51256118235a4e91d7e47f19c3103c9670b16009`; the corresponding deployment ID
  is `6ad87188bf5e0017284621fc`.
- Current Cloudflare versions at validation: Storefront
  `f851b777-6f89-4edc-9ff8-ada2a8a665fb`; Admin
  `775e97bb-3ad0-4a90-894a-089bec6886a8`.
- The reservation expiry job and Redis addon exist. No provider secret value was
  included in the evidence.

## E. Browser, capacity and cleanup evidence

- Chromium: 31/31 passed in 7.1 minutes, including visual regression.
- Firefox Linux CI: 27/27 passed in 2.3 minutes.
- WebKit: 27/27 passed in 6.7 minutes.
- Seven representative sequential Storefront requests and four bounded
  concurrent requests returned 200. Observed Worker invocations used version
  `f851b777-6f89-4edc-9ff8-ada2a8a665fb`, `outcome=ok`, and no exceptions.
- Public API live/ready and Admin smoke returned 200; restrictive CORS remained
  intact. This bounded sample is not production-capacity evidence.
- Test orders left by failed/diagnostic runs were cancelled through the
  authorized Admin API with audit reasons; no records were deleted.
- Physical devices and screen readers were not executed.

## F. External-provider evidence

| Boundary            | Status             | Evidence                                                                                                            |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| SePay               | BLOCKED externally | official rules reviewed; local webhook/security tests pass; staging disabled/incomplete, no real Test-mode delivery |
| Transactional email | BLOCKED            | idempotent outbox exists; no approved provider/worker/mailbox receipt                                               |
| Google OAuth        | BLOCKED            | state/nonce/PKCE foundation exists; adapter/callback and development credentials absent                             |
| Apple OAuth         | BLOCKED            | foundation exists; adapter, Services ID/team/key and approval absent                                                |
| Monitoring alerts   | BLOCKED            | structured logs/probes exist; no notification integration or received test alert                                    |

No production money, production provider credential or live LLM was used.

## G. Security and AI boundary

Customer/Admin realm isolation, CSRF, BOLA, price tampering, webhook
authentication/replay, order ownership, checkout idempotency and concurrency
remain in passing suites. AI stays provider-off, read-only and behind signed
NestJS gateway/tools; it has no direct MongoDB access and no Cart/Order/Payment,
Inventory or role mutation tool.

## H. Blockers and recommendation

Unresolved High release blockers:

1. no test-alert delivery or operational ownership;
2. no backup/restore and Atlas recovery rehearsal;
3. no official SePay Test-mode delivery for online payment;
4. no transactional email delivery/retry proof;
5. Google/Apple login incomplete if included in launch scope.

Additional Medium gaps include live rollback, Redis recovery, physical-device
coverage, capacity/SLO proof and operational privacy/retention policy.

**Recommendation: REMEDIATION REQUIRED — REMAIN ON STAGING.** Do not deploy
production, enable online payment/social login, begin RAG/LangGraph or permit AI
commerce mutations until the relevant blockers are separately approved,
configured and validated.
