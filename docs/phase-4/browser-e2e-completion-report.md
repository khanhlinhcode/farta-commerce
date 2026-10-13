# Phase 4.1C-B Browser E2E Completion Report

Date: 2026-10-13

Baseline: `4cde1bb` (`feat: add idempotent development catalog seed`)

## Outcome

Chromium browser release coverage now exercises the real local development catalog across Storefront and Admin. The suite uses the authoritative API boundary, real MongoDB/Redis transactions and finalized Cloudinary media. It does not fake OAuth, orders, payment success or provider delivery.

Pinned tooling:

- `@playwright/test` 1.64.0 (exact root dev dependency);
- Playwright Chromium revision 1248 and matching headless shell;
- one worker, bounded navigation/action/test timeouts;
- trace and failure screenshot retention, no video by default.

## Implemented coverage

Storefront:

- Home → New Arrivals → seeded Product;
- Shop filter/supported sort and Search → Product;
- actual color/size combination → server Cart;
- Cart quantity/remove;
- guest COD Checkout → Order confirmation → verified lookup;
- guest Cart merge on customer registration;
- logout/login → Account Orders → Order detail;
- duplicate concurrent checkout returns one logical order;
- server rejects browser-supplied total/unit price.

Admin and security:

- unauthenticated Admin UI/API denial;
- staff login → seeded catalog/inventory;
- Order detail rejects invalid transition and accepts a valid transition;
- customer realm cannot access Admin;
- customer A/B Order BOLA denial;
- authenticated mutation without CSRF denial;
- browser-visible cookie/storage checks do not expose access/refresh credentials;
- safe error bodies do not contain stack, `node_modules` or Mongo internals.

Test-created COD orders are cancelled through the real permissioned Admin cancellation endpoint after assertions so repeated local runs release reservations instead of slowly exhausting seed inventory.

## Visual regression

Twelve reviewed Chromium baselines are committed for:

- Home desktop/mobile;
- Shop desktop/mobile;
- Product detail desktop/mobile;
- Cart mobile;
- Checkout desktop/mobile;
- Login;
- Admin catalog;
- Admin order detail.

The capture helper waits for fonts and images, disables animations, fixes locale/timezone/viewport, starts from scroll top and hides only the Next.js development portal. Dynamic Admin order identity/time values are normalized or masked; layout regions are not hidden.

## Defects found during browser execution

- Checkout image layer intercepted the COD button because its fill image had no positioned containing block.
- Search disappeared on narrow mobile widths.
- Admin navigation caused horizontal overflow at 320 px.
- form errors lacked explicit accessible input associations.
- a re-login flow navigated before authentication completion; the test now waits on the authoritative Account redirect.
- repeated test COD orders exhausted seed reservations; cleanup now uses the real Admin cancellation policy.
- first-row catalog images were lazy despite being above the fold; first-row Product cards now load eagerly.

Each defect was reproduced by a browser test, fixed narrowly and rerun.

## Commands and evidence

Focused evidence completed before the final sequential gate:

```text
pnpm exec playwright test --grep-invert 'visual baseline'  -> 13 passed before security-spec addition
pnpm exec playwright test tests/browser/security.spec.ts  -> 3 passed
pnpm exec playwright test tests/browser/visual.spec.ts --update-snapshots=all -> 3 passed
```

The final gate result is recorded after the complete sequential run below.

Playwright raises only the spawned test API's configured rate-limit ceilings to schema-approved development maxima so 19 sequential cases sharing one loopback IP do not contaminate one another through Redis. Production/default values are unchanged; the API E2E suite remains the authoritative 429/rate-limit regression gate.

## CI behavior and blocker

No fake CI browser job was added. The checked-in development seed intentionally requires an ignored, environment-specific manifest whose IDs must match finalized `MediaAsset` records in the active MongoDB. A fresh GitHub Actions MongoDB does not contain those records, and copying local ObjectIds or production Cloudinary credentials would violate the phase safety rules.

Enablement requires:

1. a dedicated non-production Cloudinary account;
2. CI-injected development OWNER/staff credentials;
3. an approved repeatable media upload/finalization bootstrap that creates both provider assets and matching `MediaAsset` records;
4. then a dedicated one-worker job that runs frozen install, `infra:up`, Chromium `--with-deps`, seed, Playwright and `infra:down` in `always()` cleanup.

Until those inputs exist, local Browser E2E is the truthful release gate and CI browser execution is explicitly blocked.

## Final quality gates

| Gate                               | Result                                                       |
| ---------------------------------- | ------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`   | pass; lockfile accepted                                      |
| `pnpm format:check`                | pass                                                         |
| `pnpm lint`                        | pass                                                         |
| `pnpm typecheck`                   | pass across API, Admin, Storefront and shared packages       |
| API unit                           | 14 files, 54 tests passed                                    |
| Storefront unit/component          | 6 files, 18 tests passed                                     |
| Admin component                    | 1 file, 2 tests passed                                       |
| API E2E/security/concurrency       | 7 files, 64 tests passed                                     |
| Chromium Browser E2E               | 19 tests passed in 4.2 minutes with one worker               |
| Production build                   | API, Admin and Storefront passed with `API_INTERNAL_URL` set |
| `pnpm audit:prod`                  | no known vulnerabilities found                               |
| Python frozen sync / Ruff / Pytest | pass / pass / 2 passed                                       |
| Gitleaks 8.24.3 history            | 22 commits, about 1.42 MB, no leaks found                    |
| Gitleaks staged worktree snapshot  | 1 synthetic snapshot, about 47 KB, no leaks found            |

Runtime smoke returned HTTP 200 for API live/ready, public Category/Product/PDP/Banner APIs, Storefront Home/Shop/PDP/Cart/Checkout/Login, Admin root and AI live. Unauthenticated Admin Orders returned HTTP 401. Browser execution separately loaded the finalized Cloudinary images in all reviewed Storefront baselines.

No Lighthouse/WCAG score or production browser throughput is claimed.

## Known limitations

- Local development only; no staging/production deployment evidence.
- Chromium only; WebKit and Firefox were not installed.
- Real Cloudinary delivery was exercised, but production provider availability/retention was not validated.
- OAuth, SePay real-money movement and notification delivery remain honest unavailable/external-provider boundaries.
- CI browser automation remains blocked by reproducible non-production media bootstrap as documented above.
