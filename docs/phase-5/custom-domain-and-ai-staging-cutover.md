# Phase 5C continuation — custom-domain and AI staging cutover

Date: 2026-10-21

Verdict: **DEPLOYED WITH A REMAIN-STAGING CAPACITY BLOCKER**

This report records the custom-domain cutover and the already-approved,
read-only Product Advisor staging boundary. It does not replace the historical
Phase 5C report and does not claim production readiness.

## Deployed topology

| Boundary   | URL                                      | Evidence                                 |
| ---------- | ---------------------------------------- | ---------------------------------------- |
| Storefront | `https://staging.fartacommerce.me`       | HTTPS 200; Cloudflare custom domain      |
| Admin      | `https://admin-staging.fartacommerce.me` | HTTPS 200; Cloudflare custom domain      |
| API        | `https://api-staging.fartacommerce.me`   | `/health/live` and `/health/ready` 200   |
| AI         | private Northflank `farta-ai` service    | deterministic signed gateway call passed |

The Cloudflare deployment versions created by this cutover are:

- Storefront: `9f7a652d-70d6-4e2c-bc3d-c8cb26715742`;
- Admin: `775e97bb-3ad0-4a90-894a-089bec6886a8`.

Both Cloudflare artifacts were built from local HEAD `4fa2aab` plus the
uncommitted custom-domain configuration recorded by this report. They are live
runtime evidence, but are not yet a Git-reproducible release revision.

`workers.dev` remains enabled as a health fallback, but the NestJS API now
allows credentialed browser traffic only from the two canonical custom origins.

## DNS and TLS

- Public DNS delegation resolved to `james.ns.cloudflare.com` and
  `jean.ns.cloudflare.com` before Worker custom domains were attached.
- Storefront and Admin resolved through Cloudflare and returned HTTP 200.
- Both custom hostnames presented a valid certificate covering
  `fartacommerce.me`.
- The existing API CNAME and Northflank certificate remained healthy.
- The apex GitHub Pages records were not modified by this operation.

## Runtime origin update

A restricted Northflank config group named `FARTA API Custom Domain Staging`
was created at priority `40`, scoped only to `farta-api`. It contains only these
public configuration keys:

- `APP_ORIGIN=https://staging.fartacommerce.me`;
- `ADMIN_ORIGIN=https://admin-staging.fartacommerce.me`;
- `API_ORIGIN=https://api-staging.fartacommerce.me`.

No existing credential group or secret value was read or printed. The API was
restarted and returned deployment `COMPLETED` plus readiness HTTP 200.

Northflank reported both `farta-api` and private `farta-ai` as build `SUCCESS`
and deployment `COMPLETED` at deployed SHA `8a15e33`. A path diff confirmed
that `apps/api` and `apps/ai-service` have no source changes between that SHA
and local HEAD.

## Security smoke

- Storefront, Admin and proxied API paths returned HSTS, CSP,
  `X-Content-Type-Options` and `Referrer-Policy`.
- Staging `robots.txt` remained `Disallow: /`.
- API CORS allowed exactly the new Storefront and Admin origins.
- The former Storefront Worker origin and an untrusted origin received no
  `Access-Control-Allow-Origin`.
- Customer CSRF bootstrap through the custom Storefront returned a Secure,
  SameSite=Lax `__Secure-` cookie without exposing bearer credentials.

## AI Product Advisor

The staging AI path is the approved read-only architecture:

`Storefront -> NestJS AI Gateway -> private FastAPI/Pydantic AI service -> signed NestJS Commerce tools`.

Observed staging results:

- deterministic Vietnamese request `Tìm áo màu đen size M`: `completed`,
  `route=deterministic`, one authoritative Product Card;
- advanced styling request: `unavailable`, `route=agent`,
  `AI_PROVIDER_DISABLED`;
- the browser AI boundary tests passed in both complete test attempts before
  unrelated Storefront capacity failures occurred.

Gemini and Groq remain disabled. No live provider key, paid fallback, RAG,
LangGraph, direct database access or commerce mutation was introduced.

## Validation results

Configuration/build gates:

- `pnpm format:check`, `pnpm lint` and `pnpm typecheck`: pass;
- `uv sync --frozen`, Ruff lint, Ruff format check and Pytest: pass, with
  **25/25** AI-service tests;
- Admin and Storefront typecheck: pass;
- Admin custom-domain build and Wrangler dry-run: pass;
- Storefront OpenNext custom-domain build and Wrangler dry-run: pass;
- `git diff --check`: pass;
- custom-domain runtime and security smoke: pass.

Browser evidence, without timeout changes:

1. First full Chromium run: **30/31 passed**. The Shop RSC request rendered the
   safe Catalog-unavailable state; the matching API query and immediate focused
   rerun passed.
2. Focused Shop rerun: **1/1 passed**.
3. Second full Chromium run: **29/31 passed**. `/register` returned Cloudflare
   Error 1102 / HTTP 503. The next test timed out while creating a browser
   context after that failure.
4. Focused Cart-merge and duplicate-checkout run: duplicate Checkout passed;
   Cart merge again hit Error 1102 on `/register`, result **1/2 passed**.
5. Ten immediate direct `/register` requests returned HTTP 200, showing the
   failure is intermittent capacity exhaustion rather than a permanent route
   or form defect.

## Open blocker

Cloudflare Workers Free still enforces the previously observed CPU/resource
ceiling. The custom domain did not remove that limit. A staging commerce flow
can intermittently receive Error 1102 even though the same route succeeds on
immediate retry.

Do not mark the browser release gate PASS based on focused reruns. The smallest
correctness-preserving resolution remains an approved Workers plan with adequate
CPU, or moving the Next.js Storefront to an approved runtime with sufficient
compute. A cache redesign is a separate architectural change and must preserve
catalog invalidation and authenticated behavior.

## Remaining external blockers

- live Gemini/Groq provider compatibility, quota, quality and latency evidence;
- SePay official Test-mode webhook delivery;
- Google/Apple OAuth adapters and credentials;
- notification delivery provider and retry worker;
- monitoring alert delivery;
- Firefox Linux/CI and physical-device validation;
- live rollback rehearsal.

Recommendation: keep the environment in staging, retain deterministic
provider-off AI, and resolve Storefront runtime capacity before enabling live
LLM inference or starting a production review.
