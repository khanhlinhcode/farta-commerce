# Phase 5C — Cross-browser and device report

Date: 2026-10-20

Host: macOS 27.0.1 arm64, Node.js 22.23.2, pnpm 10.34.3

Playwright: `@playwright/test` 1.64.0

## Runner change

`playwright.config.ts` now accepts a validated comma-separated
`E2E_BROWSERS` value containing only `chromium`, `firefox` and `webkit`.
Chromium remains the default, so existing local/CI commands retain their prior
behavior. No dependency or second browser framework was added.

Firefox 157.0 (Playwright build v1555) and WebKit 27.2 (build v2370) were
installed using Playwright's existing dependency. Visual pixel snapshots remain
Chromium-only; cross-engine tests cover behavior, responsive containment and
accessibility interactions without rewriting the approved baselines.

## Commands

Credentials were injected from macOS Keychain and never printed. The common
shape was:

```bash
E2E_TARGET=staging \
E2E_BROWSERS=<browser> \
E2E_STOREFRONT_URL=https://farta-storefront-staging.linhto01012000cm.workers.dev \
E2E_ADMIN_URL=https://farta-admin-staging.linhto01012000cm.workers.dev \
E2E_API_URL=https://api-staging.fartacommerce.me \
E2E_STAFF_EMAIL='<injected>' \
E2E_STAFF_PASSWORD='<injected from macOS Keychain>' \
pnpm exec playwright test --grep-invert '@visual'
```

The established Chromium staging command, including its reviewed visual lane,
was also run through `pnpm test:browser:staging`.

## Results

| Engine   | Result                                                                                    | Interpretation                                                                      |
| -------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Chromium | **31/31 passed**, one worker, 5.5 minutes                                                 | Full suite passed against Storefront version `2fce4e69-b9b5-48c9-9fcd-430e71da7799` |
| Firefox  | **3 request-only tests passed; 24 browser tests failed before page launch**               | Host/tooling blocker, not an application assertion failure                          |
| WebKit   | Earlier runs exposed 503/1102; latest full run: **27/27 passed**, one worker, 5.3 minutes | Current deployment passed; the proven Free-plan CPU ceiling remains a release risk  |

### Firefox blocker

The bundled Firefox process exited before loading FARTA with
`Could not find profile folder`. Setting `TMPDIR=/tmp` did not resolve the
failure. The behavior matches the open Playwright/macOS issue:
<https://github.com/microsoft/playwright/issues/42768>.

No browser bundle was patched and no macOS privacy permission was silently
changed. The clean validation path is Firefox on a Linux CI runner, but the
current GitHub Actions repository has no staging browser credentials/secrets.
Firefox therefore remains **BLOCKED**, not failed application behavior.

### WebKit/Cloudflare finding

The first run's three failing screenshots/error contexts showed Cloudflare Error
1102 (`Worker exceeded resource limits`). The same three tests passed
immediately in focused reruns: one payment-tampering case passed in 7.8 seconds
and the Cart isolation plus Shop/Search cases passed 2/2 in 17.1 seconds.

The continuation run first exposed a separate test-structure issue: the entire
customer flow and final UI assertion completed successfully, but a Staff login
performed only for cleanup pushed the test beyond its existing 45-second
budget. The cleanup session is now prepared in parallel at the beginning of the
test. Focused post-change reruns passed **1/1 on Chromium in 26.5 seconds** and
**1/1 on WebKit in 32.7 seconds**, without increasing a timeout or changing
application behavior. An earlier invocation that used a stale local credential
was rejected with `AUTH_INVALID_CREDENTIALS`; it is configuration-failure
evidence and is not counted as an application result.

The next complete WebKit run finished **23 passed / 4 failed** in 10.1 minutes:

- one responsive traversal received the designed network-error page;
- one direct header request received HTTP 503;
- the PDP synchronization flow received Cloudflare Error 1102, Ray ID
  `a4d812f28ef50955`;
- the Cart variant flow received Cloudflare Error 1102, Ray ID
  `a4d813d17e338536`.

A controlled read-only reproduction then sent 12 concurrent GET requests to the
seeded PDP. Ten returned 200 and two returned 503. A simultaneous `wrangler
tail` captured both failures on deployed script version
`f9c3e5ab-3ec0-4f0d-b42c-42a2bba777ba` with `cpuTime: 10`, outcome
`exceededCpu`, and exception `Worker exceeded CPU time limit.` No request
headers, addresses or credential values are retained in this report.

Cloudflare documents 1102 as a CPU/resource-limit error and documents a 10 ms
CPU limit per request for the Free Workers plan:

- <https://developers.cloudflare.com/workers/observability/errors/>
- <https://developers.cloudflare.com/workers/platform/limits/>
- <https://developers.cloudflare.com/workers/platform/pricing/>
- <https://opennext.js.org/cloudflare/caching>

The staging Storefront currently uses `CATALOG_CACHE_MODE=no-store`, so catalog
pages execute server rendering and API reads through the Worker. Cloudflare's
current limits document lists 10 ms per HTTP request on Workers Free, and notes
that SSR-heavy workloads commonly use more CPU. OpenNext documents R2 plus a
revalidation queue as its cache architecture for a small site using time-based
revalidation.

The direct trace proves that the earlier deployment reached the Free-plan CPU
ceiling; this is no longer only an inference from an error page.

## Current deployment validation

Trace review also found a separate guest Cart race. On a first visit, the
Header's `GET /api/v1/cart` and a rapid `POST /api/v1/cart/items` could both
start without a guest cookie. If the earlier GET response finished last, its
empty-cart cookie replaced the populated Cart cookie. The Product variant
mutation now waits for the shared Cart query to settle before adding an item.
A regression test holds the initial GET open and verifies that the POST cannot
start prematurely.

The remediated Storefront was deployed as version
`2fce4e69-b9b5-48c9-9fcd-430e71da7799`. Post-deploy evidence:

- Storefront unit tests: **14 files / 42 tests passed**;
- focused Chromium Cart navigation and guest-Cart merge: **2/2 passed**;
- four batches of 12 concurrent seeded-PDP reads: **48/48 HTTP 200**, with no
  error in the simultaneous Worker tail;
- full Chromium staging suite: **31/31 passed** in 5.5 minutes;
- full WebKit functional suite: **27/27 passed** in 5.3 minutes;
- Storefront, Admin and API live/ready returned HTTP 200 at the final smoke
  checkpoint.

This is a clean current-version run, not proof that the Free-plan 10 ms CPU
limit is permanently safe. The historical controlled reproduction remains a
valid capacity finding because neither the Worker plan nor the `no-store`
catalog policy changed.

## Capacity decision checkpoint

No hosting plan or catalog consistency policy was changed automatically.

1. **Recommended smallest correctness-preserving change:** move this Cloudflare
   account/Worker to Workers Paid, keep `CATALOG_CACHE_MODE=no-store`, set a
   conservative per-invocation CPU ceiling, and rerun the full suite. The
   current official price starts at USD 5/account/month and the default Paid
   CPU budget is 30 seconds. This removes the observed 10 ms ceiling without
   changing catalog freshness semantics.
2. **Architecture change:** provision R2 plus the OpenNext revalidation queue,
   restore the existing 60-second catalog revalidation path, and define Admin
   invalidation semantics. This can reduce SSR executions but adds Cloudflare
   storage/Durable Object configuration and permits bounded stale catalog data;
   it therefore needs an explicit data-consistency decision and release tests.
3. **Larger platform change:** move the Next.js Storefront to a Node/Next-native
   host while retaining Cloudflare for DNS. This avoids the Free Worker ceiling
   but changes the deployment and rollback architecture.

Source-only micro-optimization may still be worthwhile after profiling, but it
cannot be treated as a reliable fix while the platform terminates requests at
the observed 10 ms boundary.

## Responsive and accessibility scope

Covered tests exercise 320×568, 360×800, 375×812, 390×844, 430×932, 768×1024
and 1440×900, including navigation, Search, filter drawer, product media and
variants, Cart, Checkout, Order lookup, Account, Admin tables/forms, keyboard
focus, dialogs, labels/error associations, touch targets and reduced motion.

Chromium and WebKit supplied clean full results for the current deployment.
Firefox remains blocked before browser launch on this macOS host. No physical
iPhone, Android, Safari or Chrome device was tested, and no
Lighthouse/accessibility score is claimed.
