# Phase 5B — Staging browser release validation

Date: 2026-10-20

Release verdict: **Ready with known limitations for staging stakeholder review**

This report records deployed staging evidence. It does not declare production
readiness and does not validate production money or production providers.

## A. Git revision tested

- Baseline reviewed: `fbc1b4fbdd7f49bd60ecf43e8b2ab714a9b3e4c5`.
- Release-candidate revision tested after remediation:
  `8a15e3364e9f5bd4fdc97f669681ec7d66e11304`.
- Branch: `main`.
- Before this report commit, `origin/main...HEAD` was `0 0`.

## B. Deployment revision

- Northflank API build: `SUCCESS`.
- Northflank API deployment: `COMPLETED`.
- Northflank deployed SHA:
  `8a15e3364e9f5bd4fdc97f669681ec7d66e11304`.
- Cloudflare Storefront version:
  `f9c3e5ab-3ec0-4f0d-b42c-42a2bba777ba`.
- The existing Admin Worker remained HTTP 200; no Admin source change required a
  new Worker version in this phase.
- GitHub Actions CI run `39412024340` succeeded. Its `api-e2e`,
  `secret-scan`, `python-quality`, and `node-quality` jobs all succeeded.

## C. Staging URLs

- Storefront:
  `https://farta-storefront-staging.linhto01012000cm.workers.dev`
- Admin: `https://farta-admin-staging.linhto01012000cm.workers.dev`
- API: `https://api-staging.fartacommerce.me`
- API readiness: `https://api-staging.fartacommerce.me/api/v1/health/ready`
- FastAPI remains private. NestJS reaches it using Northflank project-internal
  service discovery; no public FastAPI URL is required by browser tests.

## D. Runtime health responses

- Public API `/api/v1/health/live`: HTTP 200, `status=ok`.
- Public API `/api/v1/health/ready`: HTTP 200, `status=ok`.
- Private FastAPI `/health/live` from the API container: HTTP 200,
  `status=ok`.
- Private FastAPI `/health/ready` from the API container: HTTP 200,
  `status=ok`.
- Storefront and Admin roots: HTTP 200 over HTTPS.

## E. Catalog counts after validation

Read through public and authorized Admin APIs after the full browser run:

| Resource                   |                           Count/state |
| -------------------------- | ------------------------------------: |
| Active categories          |                                     3 |
| Active products            |                                     2 |
| Public variants            |                                     9 |
| Staging sample media       | 5 total: 3 catalog plus 2 hero assets |
| Active `home-hero` banners |                                     1 |
| Inventory records          |                                     9 |
| Aggregate `onHand`         |                                    83 |
| Aggregate `reserved`       |                                     0 |

The suite did not reseed staging and did not write directly to MongoDB.

## F. Browser test command

The staging command does not seed data and does not start local servers:

```bash
E2E_TARGET=staging \
E2E_STOREFRONT_URL=https://farta-storefront-staging.linhto01012000cm.workers.dev \
E2E_ADMIN_URL=https://farta-admin-staging.linhto01012000cm.workers.dev \
E2E_API_URL=https://api-staging.fartacommerce.me \
E2E_STAFF_EMAIL='<injected>' \
E2E_STAFF_PASSWORD='<macOS Keychain>' \
pnpm test:browser:staging
```

Only credential presence was verified. Credential values were not printed,
committed, or copied into application environment files.

## G. Browser result

- Browser: Playwright `1.64.0`, Chromium project, one worker.
- Final deployed-staging result: **31 passed in 4.9 minutes**.
- Final result retained no failure trace because there was no failure.
- Four additional staging-specific tests cover runtime/public DTO/media,
  headers/robots/CORS, secure isolated guest Cart state, and fail-closed guest
  lookup.
- Four focused post-deployment Product Advisor and visual tests passed before
  the complete run.

## H. Commerce flow results

The deployed browser suite passed:

- Home → New Arrivals → real Product.
- Shop filter/sort → Product and Search → Product.
- Black/Cream and size selection with synchronized product media.
- Guest add/update/remove Cart and refresh persistence.
- Guest Cart isolation in a second browser context.
- Cart → authoritative Checkout preview → COD order → confirmation.
- Guest lookup with order code plus phone verification.
- Guest Cart merge on email/password registration.
- Logout/login → Account orders → owned Order detail.
- Admin login → real catalog/inventory/order detail → valid and invalid
  transition behavior.
- Concurrent duplicate Checkout with one idempotency key → one logical Order.

The API E2E suite separately passed stale-price conflict, transaction rollback,
reservation expiry/release, Order BOLA, lookup throttling, and the 100-way final
unit concurrency test. Those are local isolated integration results, not
shared-staging load-test claims.

## I. COD order evidence

The final run produced authorized test COD orders and cancelled them through
the Admin domain API. A safe sample is:

- `FAR-20261020-WYYR8MUU28`: `CANCELLED`, payment `UNPAID`, method `COD`.
- `FAR-20261020-8HFUMM5KE9`: `CANCELLED`, payment `UNPAID`, method `COD`.

COD selection never marked payment as collected. The failed baseline left
`FAR-20261020-S2SJSL3VDZ` in `CREATED`; it was identified by its exact E2E
recipient marker and safely cancelled through the authorized Admin API. No
hard-delete or direct database cleanup was used.

## J. Cart and Order BOLA

- A second clean browser context did not receive the first guest's Cart.
- Customer B could not read Customer A's order (`403`/`404` policy response).
- Public Order lookup required both the non-sequential order code and matching
  phone digest input.
- A synthetic unknown order plus phone returned a bounded `400`/`404` response
  without internal identifiers or stack/database details.

## K. CSRF and RBAC

- Authenticated customer mutation without the CSRF token returned `403`.
- Customer realm access to Admin APIs returned `401`/`403`.
- Unauthenticated Admin navigation/API remained protected.
- Invalid Staff credentials produced a safe UI error.
- Admin state transition permissions remained server-side; an invalid
  transition failed without the browser bypassing the state machine.
- AI chat rejected an untrusted Origin, and unsigned internal AI tool access
  returned `401`.

## L. Responsive coverage

The suite exercised `320×568`, `360×800`, `375×812`, `390×844`, `430×932`,
`768×1024`, and `1440×900`.

No horizontal overflow was detected for the required Storefront routes or
Admin tables/forms. Mobile navigation, Search, filter drawer, hero, PDP,
variant controls, Cart, Checkout, Order lookup, and Product Advisor stayed
inside the viewport.

## M. Accessibility observations

Automated browser interactions verified:

- keyboard focus enters and leaves navigation/search/filter/dialog surfaces;
- Escape and close controls restore focus where covered;
- form labels and error associations are present in covered auth/checkout
  flows;
- reduced-motion mode avoids campaign autoplay behavior;
- color and size controls expose selected/disabled state;
- representative mobile controls meet the repository touch-target assertions.

No Lighthouse score, manual screen-reader session, or full manual contrast
audit was run; none is claimed.

## N. Security headers and indexing

Storefront, Admin, and API returned HSTS, CSP, `X-Content-Type-Options:
nosniff`, and `Referrer-Policy`. Frame protection was present through
`frame-ancestors 'none'` and, for Admin/API, `X-Frame-Options` where configured.

- Storefront CSP explicitly bounds Cloudinary image/media delivery.
- An untrusted Origin did not receive an
  `Access-Control-Allow-Origin` response.
- Staging `robots.txt` returned `Disallow: /`.
- Session/Cart credentials remained in Secure HttpOnly cookies; bearer tokens
  were not found in browser storage.

## O. Screenshots and traces

Fourteen reviewed Chromium baselines remain under
`tests/browser/__screenshots__/chromium/visual.spec.ts/` for Home, Shop, PDP,
Login, Cart, Checkout, Product Advisor, Admin catalog, and Admin order detail.

The initial failing diagnostic run created failure screenshots and traces for
the hero and Product Advisor. They were inspected locally and were not added to
Git. The final passing run retained only `.last-run.json`, as configured.

## P. Failures found and fixes

1. **P1 — Checkout idempotency index absent on staging.** The schema declared
   the unique key, but deployed `autoIndex=false` meant the collection had only
   `_id_`. Concurrent Checkout returned `404/201`. Schema-declared indexes were
   created with `Model.createIndexes()` (no index/data deletion), then the same
   browser test passed `201/201` with one order code. A guarded
   `indexes:staging` command now exists for repeatable deployment operations.
2. **P2 — Desktop hero rendered the mobile asset.** Cloudflare's unoptimized
   image mode returned no generated `srcSet`, leaving both `<source>` elements
   empty. The component now falls back to the authoritative desktop/mobile
   Cloudinary URLs, with a component regression test. Visual baselines passed
   after deployment; snapshots were not rewritten.
3. **P2 — Product Advisor gateway disabled.** FastAPI was healthy but NestJS
   returned `AI_DISABLED`. Restricted Northflank secret groups now enable the
   deterministic provider-off path with independent gateway/tool/conversation
   secrets. Gemini and Groq remain disabled. The API is allowed to use plain
   HTTP only for an explicit single-label private staging service host;
   production still requires HTTPS.
4. **P2 — Local workspace unit tests contended for CPU.** Parallel Vitest
   packages caused unrelated bcrypt/dialog/payment tests to exceed existing
   timeouts. Each failed test passed in isolation. The root unit gate now runs
   workspaces sequentially without changing test timeouts.

Initial browser result was `22 passed / 5 failed`; after root-cause fixes the
complete deployed result was `31 passed / 0 failed`.

## Q. Quality gates

| Command                          | Result                                  |
| -------------------------------- | --------------------------------------- |
| `pnpm install --frozen-lockfile` | pass; lockfile unchanged                |
| `pnpm format:check`              | pass                                    |
| `pnpm lint`                      | pass                                    |
| `pnpm typecheck`                 | pass                                    |
| `pnpm test`                      | pass: Admin 14, API 92, Storefront 41   |
| `pnpm test:e2e`                  | pass: 65 API E2E tests                  |
| `pnpm build`                     | pass: API, Admin, Storefront            |
| `uv sync --frozen`               | pass: 52 packages checked               |
| `uv run ruff check .`            | pass                                    |
| `uv run pytest`                  | pass: 25 tests                          |
| `pnpm audit:prod`                | pass: no known vulnerabilities reported |
| `git diff --check`               | pass                                    |
| GitHub Actions CI `39412024340`  | pass, including CI secret scan          |
| `pnpm test:browser:staging`      | pass: 31 tests in 4.9 minutes           |

Dedicated local `gitleaks`, `trufflehog`, and `detect-secrets` CLIs were not
installed. The repository's GitHub CI `secret-scan` job did run and pass.

## R. Known limitations and external providers not validated

- Only Chromium browser automation was executed; Firefox/WebKit and physical
  mobile devices were not validated.
- SePay production and real-money transfer were not used.
- Google OAuth, Apple Sign in, and transactional email delivery were not
  validated.
- Gemini/Groq live inference was intentionally disabled. Product Advisor
  evidence covers deterministic tools and provider-off fail-closed behavior.
- No production domain, production cookies, edge WAF, production Atlas/Redis,
  or production rollback was tested.
- No destructive stock-race load was run against shared staging. The isolated
  API E2E suite supplies the 100-way concurrency evidence.
- The old lower-priority Northflank secret group still contains stale,
  rotated-out values. Higher-priority restricted groups override them; the old
  values should be removed when safe field-level secret editing is available.
- The GitHub Dependabot update run associated with the candidate SHA failed;
  the required project `CI` workflow itself passed. Dependency update
  automation should be inspected separately.

## S. Recommended next phase

Proceed to stakeholder staging review and external-provider validation, not
production deployment. The next bounded work should validate SePay test mode,
OAuth development credentials, email delivery/retry, WebKit/physical-device
behavior, monitoring alerts, and a documented rollback rehearsal. Do not begin
RAG, LangGraph, or AI commerce mutations from this phase.
