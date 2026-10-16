# Release remediation status report

Date: 2026-10-16
Status: **partial; release blockers remain**

## Completed local groups

- A Related Products category contract.
- B Auth success separated from Cart merge.
- C Customer profile and persistent onboarding.
- F Truthful ProductCard price presentation.
- G Media reference integrity.
- H Admin operational completion (local code/API scope).
- I Admin confirmation/focus and form accessibility improvements.
- J Mobile filter close/focus behavior.
- K Paginated sitemap.
- L Bounded public catalog query.
- M/N Image delivery and accessibility changes.
- O Current-revision server defaults and configurable isolated ports/modes.
- CI now runs `format:check`; API E2E files run serially to avoid full-Nest startup contention while retaining in-suite concurrency tests.

## Current evidence

- `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint` and `pnpm typecheck` passed on the final working diff.
- Unit/component: API 16 files/77 tests, Storefront 13 files/38 tests and Admin 5 files/14 tests passed. The Storefront total includes image-priority, responsive hero art-direction and rolling-deployment category compatibility regressions.
- API E2E: first parallel file run hit six startup hook timeouts; after `fileParallelism:false`, 7 files and 65 tests passed without increasing timeouts.
- `API_INTERNAL_URL=http://127.0.0.1:4000 pnpm build` passed for API, Admin and Storefront after the final image and hydration changes. Current Admin feature chunks were emitted. Storefront build warned that the Sitemap API was unavailable because no API process was running.
- Dependency audit reported no known production dependency vulnerability. Python frozen sync, Ruff and 8 Pytest tests passed. A local Gitleaks binary was unavailable, so the configured CI secret scan was not reproduced locally.
- Browser E2E: 22/22 Chromium tests passed in 2.9 minutes against newly started production API/Storefront artifacts and the current Admin dev server. Coverage includes responsive layouts, focus behavior, visual baselines, Cart/Checkout/COD, guest lookup, Cart merge, session logout/login, order ownership, Admin permissions/transitions and duplicate checkout idempotency.

## Blocked groups

- D Password recovery: requires approval for `notification_events`/recovery outbox schema evolution before implementing the durable pending intent. Email provider delivery is not configured.
- E Google/Apple OAuth: credentials and callback domains are unavailable; no fake provider success was added.
- P Next generated-file policy: Next 16.3.8 officially treats `next-env.d.ts` as generated and recommends ignoring/untracking it. Removing a tracked file requires stakeholder approval. Build currently leaves it unchanged, but dev/build drift policy is unresolved.
- Q Strict nonce/hash CSP: nonce adoption would force dynamic rendering and materially change the current ISR/cache strategy; no unapproved rewrite was made.
- R Notification delivery: provider and worker/SDK approval are unavailable; outbox events remain pending.

## Release conclusion

The implemented local remediation groups and browser release gate are complete, but the repository is not production-ready. The reviewed batch is committed locally; no push or deployment is performed. Completion still requires the D/E/R external-provider and schema decisions, a stakeholder decision for P/Q and real staging validation.
