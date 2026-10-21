# Phase 5D — Cloudflare Worker capacity and reproducibility remediation

Date: 2026-10-21

Verdict: **PASS for the Phase 5D remediation scope; remain staging**.

This report records a targeted remediation for the intermittent Storefront
Cloudflare Error 1102/HTTP 503 finding. It does not claim production readiness,
does not change the Worker plan, and does not enable paid Cloudflare resources.

## Initial deployed state

| Boundary          | Initial version/revision                 | Canonical staging URL                    |
| ----------------- | ---------------------------------------- | ---------------------------------------- |
| Storefront Worker | `9f7a652d-70d6-4e2c-bc3d-c8cb26715742`   | `https://staging.fartacommerce.me`       |
| Admin Worker      | `775e97bb-3ad0-4a90-894a-089bec6886a8`   | `https://admin-staging.fartacommerce.me` |
| API               | Northflank source SHA `8a15e33`          | `https://api-staging.fartacommerce.me`   |
| AI                | Northflank source SHA `8a15e33`, private | no public URL                            |

The initial local Git revision was `4fa2aab`, three commits ahead of
`origin/main`. Existing uncommitted custom-domain configuration was retained.

## Reproduction and root cause

The existing Phase 5C controlled reproduction captured `outcome=exceededCpu`
and `Worker exceeded CPU time limit` for the prior Storefront version during
bounded concurrent seeded-PDP reads. Two of 12 requests returned HTTP 503; the
tail recorded `cpuTime: 10` for the failing Free-plan executions. This is the
runtime evidence for Error 1102; it was not inferred from a browser error page.

The Phase 5D audit found three contributing implementation issues:

1. Persistent navigation links used Next.js automatic prefetch. A single
   `/shop` navigation generated multiple RSC requests for the global navigation
   destinations and product links. This multiplied Worker/API work before a
   visitor chose a destination.
2. Static routes such as `/register` and `/login` were already prerendered, but
   the OpenNext default cache did not intercept their route-cache assets before
   invoking the Worker. They therefore still consumed Worker capacity.
3. `publicRequest()` caught Next.js's internal static-generation bailout thrown
   by `fetch(..., { cache: "no-store" })`. It converted the framework signal to
   a false `UNAVAILABLE` result. Sitemap generation then silently degraded in
   optional mode and failed in required mode even when the API itself was
   healthy.

The third point was verified locally: direct Node and curl requests to
`GET /api/v1/products?page=1&limit=100&sort=newest` returned HTTP 200, while
the old build failed during sitemap prerender. The installed Next.js 16.4.2
documentation identifies `fetch(..., { cache: "no-store" })` as an internal
error that must be passed to `unstable_rethrow` when caught.

## Remediation

- OpenNext now uses `staticAssetsIncrementalCache` with
  `enableCacheInterception: true`. Only build-time static route artifacts are
  intercepted; transaction/session API responses are not cached.
- Persistent header, footer and product-card links set `prefetch={false}`.
  Navigation remains available, but idle global RSC fan-out is removed.
- Runtime catalog rendering retains `CATALOG_CACHE_MODE=no-store`; freshness
  was not traded for caching.
- `publicRequest()` calls `unstable_rethrow(error)` before treating a genuine
  network/API exception as catalog unavailability.
- Sitemap now has an explicit policy. `SITEMAP_DATA_POLICY=required` is used
  for staging Cloudflare builds; it uses the authoritative API with build-only
  `force-cache`, retries at most once, and fails the build if required category
  or product data remains unavailable. Development/CI may explicitly use the
  documented `optional` policy and never receives fake sitemap entries.

The staging OpenNext build completed successfully after this change and emitted
static cache assets for `/register`, `/login`, `/cart`, `/checkout`,
`/robots.txt` and `/sitemap.xml`.

## Candidate runtime evidence

Candidate Storefront version: `0e18f355-904d-4c04-b1a3-707dcd74a8ee`.

- 21 sequential GET requests across `/`, `/shop`, `/register`, `/login`, the
  seeded PDP, `/cart` and `/checkout`: HTTP 200.
- Four bounded concurrent requests (`/shop`, `/register`, `/login`, `/cart`):
  HTTP 200.
- Worker tail for the candidate showed `outcome=ok`, no exceptions and no
  controlled HTTP 503/1102 event.
- Staging `robots.txt` remained `User-Agent: *` plus `Disallow: /`.

This bounded sample is evidence that the candidate corrected the observed
request pattern. It is not a production-capacity guarantee for the unchanged
Cloudflare Free plan.

## Regression evidence

| Gate                         | Actual result               |
| ---------------------------- | --------------------------- |
| Frozen install               | pass; 9 workspaces          |
| Format, lint, root typecheck | pass                        |
| API unit                     | 20 files / 92 tests passed  |
| Storefront unit              | 15 files / 47 tests passed  |
| Admin unit                   | 5 files / 14 tests passed   |
| API E2E/security/concurrency | 7 files / 65 tests passed   |
| Workspace production build   | pass                        |
| Production dependency audit  | no known vulnerabilities    |
| AI frozen sync, Ruff, Pytest | pass; 25 tests passed       |
| Staging Chromium             | 31/31 passed in 4.9 minutes |
| Staging WebKit               | 27/27 passed in 4.3 minutes |

Browser suites used one worker, the existing timeouts and no isolated rerun as
a substitute for a failed full gate. Chromium includes the approved visual
lane; WebKit excludes only Chromium pixel snapshots by existing configuration.
Both suites cover Cart, Cart merge, checkout idempotency, COD, Admin RBAC,
security boundaries, deterministic Product Advisor and provider-off failure.

## Security impact

No authentication, CSRF, CORS, cookie, ownership, inventory, order, payment,
AI authorization or API-origin rule was relaxed. Browser tests exercised
customer/Admin separation, customer order BOLA, client-total rejection,
restrictive headers/CORS/robots, guest Cart isolation, guest-order lookup and
the signed private AI boundary.

## Reproducibility and rollback

The verified remediation was committed as:

- Git SHA: `0160bd3f0e39e325328641c11564346a97537235`;
- commit: `fix: stabilize storefront worker runtime`.

The Storefront was rebuilt from the clean committed worktree and deployed as
Cloudflare version `f851b777-6f89-4edc-9ff8-ada2a8a665fb`. The command did not
change Admin, API or AI; their versions/revisions remain those in the initial
state table. Cloudflare's version metadata does not itself carry a Git SHA, so
the source-to-artifact association is the recorded clean-tree CLI deployment,
not an independently attested provider provenance feature.

Post-deploy smoke sent seven representative sequential Storefront requests and
four bounded concurrent requests. All returned HTTP 200. A version-filtered
Worker tail recorded only `outcome=ok`, HTTP 200 and zero exceptions for the
observed requests. Storefront, Admin and API readiness also returned HTTP 200.

Rollback target for the Storefront is the initial known-good version
`9f7a652d-70d6-4e2c-bc3d-c8cb26715742`. The Admin/API/AI source is unchanged
by this remediation.

## Remaining limits

- Cloudflare Free-plan capacity is still a risk outside this bounded validated
  workload. An Error 1102 recurrence requires the phase to remain blocked and
  needs stakeholder approval for either a Workers plan with adequate CPU or an
  approved Next.js runtime migration.
- Firefox is blocked by the local macOS Playwright browser-launch issue and is
  not reclassified by this phase.
- SePay Test-mode delivery, OAuth, email delivery/retry, monitoring alert
  delivery, physical-device coverage and production validation remain outside
  the completed evidence.
