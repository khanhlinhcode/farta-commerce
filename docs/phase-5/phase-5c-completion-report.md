# Phase 5C — Completion report

Date: 2026-10-20

Verdict: **INCOMPLETE — remain on staging and remediate/configure blockers**

The source and local regression baseline are healthy, and the deployed Chromium
commerce path remains green. Phase 5C cannot be accepted because the final
Storefront/Admin domains, external SePay/OAuth/email/monitoring evidence,
Firefox execution, physical devices and live rollback rehearsal are absent.

## A. Reviewed revision and deployment state

- Git baseline: `efa6f0fdd4342bdcbf7175a288f02e1a5d3a22bb` on `main`.
- At baseline inspection: `origin/main...HEAD = 0 0` and clean worktree.
- GitHub Actions CI run `39413581525`: success for the baseline SHA.
- API live/ready, Storefront and Admin: HTTP 200 over HTTPS.
- Cloudflare Storefront version:
  `2fce4e69-b9b5-48c9-9fcd-430e71da7799` (100%).
- Cloudflare Admin version:
  `b4d06f53-78e2-49a4-9565-376cb4a657eb` (100%).
- Northflank API and private AI service: build `SUCCESS`, deployment
  `COMPLETED` at the inspection checkpoint.

## B. Repository changes

- Added validated `E2E_BROWSERS` selection to the existing Playwright runner;
  Chromium remains the default.
- Fixed the first-guest-Cart cookie race by serializing Cart hydration before
  the first add-item mutation, with a deterministic deferred-response test.
- Prepared Staff cleanup authentication in parallel with the long customer
  browser flow; this removed cleanup-only test overhead without raising the
  timeout.
- Added the Phase 5C provider, domain/security, cross-browser, rollback and
  completion reports.
- No production dependency, schema, commerce invariant, secret or DNS record
  was changed.

## C. Baseline quality evidence

| Command                                | Actual result                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`       | pass; 9 workspaces, lockfile current                                                                 |
| `pnpm format:check`                    | pass                                                                                                 |
| `pnpm lint`                            | pass                                                                                                 |
| `pnpm typecheck`                       | pass                                                                                                 |
| `pnpm --filter @farta/api test`        | 20 files / 92 tests passed                                                                           |
| `pnpm --filter @farta/storefront test` | 14 files / 42 tests passed                                                                           |
| `pnpm --filter @farta/admin test`      | 5 files / 14 tests passed                                                                            |
| `pnpm test:e2e`                        | 7 files / 65 tests passed                                                                            |
| `pnpm build`                           | API, Storefront and Admin passed; sitemap logged unavailable product page while local API was absent |
| `pnpm audit:prod`                      | no known vulnerabilities reported                                                                    |
| `uv sync --frozen`                     | 52 packages checked                                                                                  |
| `uv run ruff check .`                  | pass                                                                                                 |
| `uv run ruff format --check .`         | 25 files already formatted                                                                           |
| `uv run pytest`                        | 25 tests passed                                                                                      |
| GitHub Actions CI `39413581525`        | success, including repository secret-scan job                                                        |

No local `gitleaks`, `trufflehog` or `detect-secrets` binary was installed; the
successful GitHub Actions secret-scan job is the retained secret-scan evidence.

Provider-specific rerun:

```bash
pnpm --filter @farta/api exec vitest run \
  --config vitest.e2e.config.mts test/payments.e2e-spec.ts
```

Result: 1 file / 16 tests passed in 6.41 seconds.

## D. Browser and runtime evidence

- Chromium staging: **31/31 passed** in 5.5 minutes against Storefront version
  `2fce4e69-b9b5-48c9-9fcd-430e71da7799`.
- WebKit first functional run: **24 passed / 3 transient 1102 failures**;
  focused rerun of all three: **3/3 passed**.
- WebKit continuation full run after isolating test cleanup: **23 passed / 4
  failed**; failures included one HTTP 503 and two explicit Cloudflare 1102
  pages. Focused reruns of the cleanup-adjusted flow passed **1/1 on Chromium**
  and **1/1 on WebKit** without a timeout increase.
- After the guest-Cart race fix and redeployment, the full WebKit functional
  suite passed **27/27** in 5.3 minutes. The full Chromium suite also passed
  **31/31**. A four-batch concurrent PDP check returned **48/48 HTTP 200** and
  the simultaneous Worker tail recorded no errors.
- Firefox: **3 request-only passed / 24 blocked before browser launch** by the
  Playwright/macOS profile error.
- Physical devices: not tested.
- The FastAPI service remains private; its live/ready boundary was verified from
  the NestJS/Northflank runtime path during baseline inspection.

The earlier WebKit observation remains a Cloudflare Free Worker CPU/resource
risk. The Storefront's staging catalog is configured `no-store`, causing SSR on
catalog requests. A controlled 12-request PDP reproduction returned ten 200s
and two 503s; `wrangler tail` recorded both failures as `exceededCpu` at exactly
10 ms on prior Storefront version
`f9c3e5ab-3ec0-4f0d-b42c-42a2bba777ba`. The latest deployment passed all
recorded lanes, but no cache policy or hosting plan changed, so this historical
capacity evidence is not treated as permanently remediated.

## E. External provider evidence

- SePay: local signed integration/security tests pass and current official
  authentication documentation matches the adapter. Real Test-mode delivery is
  **BLOCKED** by missing Test-mode configuration/evidence.
- Google OAuth: **BLOCKED**; provider-neutral foundation exists, but a concrete
  adapter/public callback and development credentials do not.
- Apple OAuth: **BLOCKED** for the same implementation and credential boundary.
- Email: **BLOCKED**; outbox intents exist, delivery provider/worker does not.
- Monitoring alerts: **BLOCKED**; structured safe logs/health exist, but no
  configured alert integration or delivery proof exists.
- No production money was used.

## F. Custom-domain and security status

- API custom domain remains healthy over valid HTTPS.
- Storefront/Admin remain on `workers.dev`; target custom domains do not resolve.
- Namecheap remains authoritative; the Cloudflare account has no active zone for
  `fartacommerce.me`.
- Continuation preflight confirmed the current Cloudflare OAuth token is
  read-only for zones and lacks DNS-record write permission. No Namecheap API
  credential is configured, and AXFR is refused, so complete record parity and
  nameserver mutation remain fail-closed.
- The Namecheap Domain screen confirmed that no Email Redirect or catch-all is
  configured. Email migration is therefore not a cutover blocker; the existing
  forwarding MX/SPF records reflect the selected mail mode, not an active rule.
- The exact DNS delegation and record-preservation plan is documented in
  `staging-domain-security-review.md` and awaits explicit approval.
- Current Worker origins have exact CORS behavior and an untrusted origin is
  rejected. Final-domain TLS, cookies, CORS, CSRF and canonical metadata remain
  unverified until cutover.
- Staging remains non-indexable.

## G. Rollback

Immutable Cloudflare deployment/version targets and Northflank service status
were recorded. A non-destructive procedure is documented. A live rollback was
not executed while domain/provider/capacity work is incomplete, so rollback is
**PENDING**, not PASS.

## H. Acceptance matrix

| Acceptance criterion                               | Status                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Storefront/Admin custom domains and TLS            | BLOCKED — complete DNS inventory and Cloudflare write access required       |
| API custom domain healthy                          | PASS                                                                        |
| Staging non-indexable                              | PASS on current Worker URL                                                  |
| Final-domain cookies/CORS/CSP/CSRF                 | BLOCKED — final domains absent                                              |
| Chromium suite                                     | PASS, 31/31                                                                 |
| Firefox                                            | BLOCKED by host/Playwright issue                                            |
| WebKit                                             | PASS on current version, 27/27; prior CPU exhaustion remains a tracked risk |
| SePay official Test-mode webhook                   | BLOCKED                                                                     |
| Webhook replay/mismatch local integration          | PASS, included in 16/16                                                     |
| Browser return cannot mark paid                    | PASS, local integration test                                                |
| Google OAuth development flow                      | BLOCKED                                                                     |
| Apple OAuth                                        | BLOCKED                                                                     |
| Email delivery/retry                               | BLOCKED                                                                     |
| Monitoring alert delivery                          | BLOCKED                                                                     |
| Rollback rehearsal                                 | PENDING                                                                     |
| Phase 1–5B regressions                             | PASS in current local/CI scope                                              |
| Critical/High unresolved in validated source scope | none identified by executed suites; external/capacity gaps remain           |

## I. Recommendation

**Remain on staging.** Do not proceed to production review yet.

Next order:

1. approve and execute the documented Cloudflare DNS-zone/custom-domain plan;
2. update API origins and frontend canonical configuration atomically;
3. decide the capacity policy: Workers Paid while preserving `no-store` is the
   smallest correctness-preserving option; otherwise explicitly accept the
   Free-plan risk or approve an R2/revalidation design. Run Firefox on Linux CI;
4. configure SePay Test mode through the provider/Northflank secret stores and
   capture a real signed webhook without production money;
5. separately approve/implement Google OAuth adapter, email delivery and alert
   integration;
6. perform the live staging rollback rehearsal;
7. rerun the final-domain Chromium/Firefox/WebKit security and commerce lanes.

No commit or deployment should be presented as a completed Phase 5C release
until those required acceptance criteria are satisfied.
