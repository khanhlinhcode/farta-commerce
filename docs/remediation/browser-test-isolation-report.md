# Browser test isolation report

Date: 2026-10-16

## Implemented safeguards

- Playwright does not reuse an existing API/Storefront/Admin server unless `E2E_REUSE_SERVERS=true` is explicitly set.
- Web-server commands and CORS origins now follow `E2E_STOREFRONT_URL`, `E2E_API_URL` and `E2E_ADMIN_URL`, allowing a current-worktree run on non-default ports.
- Optional `E2E_API_MODE=production` and `E2E_STOREFRONT_MODE=production` run compiled artifacts without terminating a developer-owned Next dev process.
- Development seed remains idempotent; this run reported `created=0 updated=0 skipped=24`.
- Existing development users/orders were not deleted. Cleanup selection and approval rules are in `browser-test-data-cleanup-plan.md`.

## Initial interrupted run

Default-port execution was not used because ports 3000 and 5173 were already owned by other local processes. The first alternate dev run was correctly rejected by Next.js's same-checkout dev lock. A production-artifact run then started 22 Chromium tests but was interrupted after systematic timeouts/failures.

Evidence at failure time:

- host load average: `146.05 123.35 97.99`;
- API health responses were delayed while the virtualization/Docker host was saturated;
- Product requests rendered the safe Catalog API unavailable state;
- an Admin invalid-login request remained pending past the assertion window;
- one deterministic test drift was identified and fixed: the Product action link again exposes `Variants & tồn kho`.

No timeout was increased and no stale server reuse was enabled to hide that condition.

## Final release run

After host load normalized, the current revision was rebuilt and run with `E2E_API_MODE=production` and `E2E_STOREFRONT_MODE=production`. A focused authenticated Cart/COD/logout/login/order-history flow passed in 22.4 seconds. The complete Chromium suite then passed 22/22 tests in 2.9 minutes.

Two regressions discovered during rerun were fixed at their application boundary:

- header menu/search controls remain disabled until React hydration, so SSR controls cannot accept a dead early interaction;
- current-session logout uses one `router.replace("/login")` navigation instead of racing `router.push()` with `router.refresh()`.

The Admin catalog visual baseline was deliberately updated after inspecting the intended multi-category, pagination and archive-control UI. No timeout or visual-diff threshold was relaxed.

## Remaining isolation boundary

A fully disposable `_browser_e2e` database and automated cleanup are not implemented because dropping/resetting data requires stakeholder approval and the finalized Cloudinary development manifest must be bootstrapped safely. The current suite uses unique customer identities and domain cancellation helpers, but an interrupted run can leave historical test-shaped records. Six retained `CREATED` Browser-E2E-shaped orders were observed after prior interrupted runs; they were not deleted or rewritten by this remediation.
