# Phase 4.1D Admin Modularization Report

Date: 2026-10-13

## Scope

This change reduces Admin maintenance risk without changing API contracts, backend permissions, Order/Payment state machines or authoritative commerce rules. Historical Phase 1–4 completion reports remain unchanged.

## Repository changes

- Reduced `apps/admin/src/app.tsx` to the authentication boundary and route composition.
- Organized Admin behavior under feature modules for authentication, dashboard, categories, products, variants, inventory, media, banners and orders.
- Split the former combined Orders file into list, detail, panel, formatting and transition-policy modules.
- Kept authenticated API transport, CSRF header handling and response types in `apps/admin/src/lib/`.
- Replaced the hardcoded inventory adjustment reason with an explicit bounded reason field.
- Added a distinct permission-denied state for authenticated authorization failures.
- Added an explicit payment-conflict reconciliation warning.

## Test coverage added

Admin component/unit coverage now includes:

- safe staff login errors;
- permission-denied rendering;
- category create/update-compatible validation;
- product validation;
- integer price and compare-price validation;
- required inventory adjustment reason;
- banner validation;
- invalid Order transition policy;
- safe media-provider failure;
- payment-conflict rendering.

Focused Admin evidence before the full repository gates:

- `pnpm --filter @farta/admin test`: 4 files / 12 tests passed.
- `pnpm --filter @farta/admin typecheck`: passed.

## Documentation alignment

- `PRODUCT.md` and `README.md` now distinguish implemented local evidence from staging/provider validation.
- The current roadmap includes Phase 4.1 and the not-started Phase 5 boundary.
- PDP shipping/returns copy no longer says the policy is waiting for Phase 4, which has already been implemented.

## Known limitations

- This refactor does not add missing catalog update/archive workflows; it preserves existing behavior.
- Browser CI remains blocked on an approved reproducible non-production Cloudinary/MediaAsset bootstrap; the complete local Chromium release lane is green.
- Staging, real SePay Test-mode, OAuth and notification delivery are not validated by this change.
- Historical phase reports intentionally retain the evidence and limitations recorded at their completion dates.

## Final gate evidence

| Gate                               | Result                                                           |
| ---------------------------------- | ---------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`   | Passed; lockfile current                                         |
| `pnpm format:check`                | Passed                                                           |
| `pnpm lint`                        | Passed                                                           |
| `pnpm typecheck`                   | Passed for all TypeScript workspaces                             |
| API unit                           | 14 files / 54 tests passed                                       |
| Storefront unit/component          | 6 files / 18 tests passed                                        |
| Admin unit/component               | 4 files / 12 tests passed                                        |
| API E2E/security/concurrency       | 7 files / 64 tests passed                                        |
| Production build                   | API, Admin and Storefront passed with `API_INTERNAL_URL` set     |
| Production dependency audit        | No known vulnerabilities found                                   |
| Python frozen sync / Ruff / Pytest | Passed / passed / 2 tests passed                                 |
| Complete local Browser E2E         | 20 Chromium tests passed in 1.2 minutes with one worker          |
| AI live/ready smoke                | HTTP 200 for both endpoints                                      |
| Diff/high-signal changed-file scan | `git diff --check` passed; no high-signal secret pattern matched |

The complete local Chromium lane was rerun with an ignored development-only OWNER credential after the runner had validated the credential shape and isolated it from browser traces and application child processes. It covered responsive and keyboard behavior, authenticated Admin catalog/order flows, authorization boundaries, authoritative Cart/Checkout behavior, COD, guest lookup, Cart merge and concurrent duplicate checkout. No credential value is stored in tracked source or this report.

The prior Phase 4.1C-B report remains historical evidence for its 19-test run. The current 20-test result adds the Admin invalid-credential UI regression and is the Phase 4.1D browser evidence.
