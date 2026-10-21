# Phase 6 completion report

Date: 2026-10-22

Verdict: **provider-independent implementation and exact-revision staging validation complete;
live provider and production controls remain BLOCKED. Remain on staging.**

## Source implemented

- bounded single-provider Pydantic AI execution; automatic fallback rejected;
- safe request/provider/tool/response events and in-process metrics hooks;
- bounded authoritative tool observations and fail-closed output grounding;
- 62 unique Vietnamese cases across 14 required categories;
- no-accent/spelling/context and forbidden-intent router coverage;
- Storefront timeout, explicit one-time retry, focus restoration and source distinction;
- current AI/runbook/product documentation alignment.

No RAG, LangGraph, vector database, commerce mutation, production dependency or production deploy
was added.

## Evidence boundary

| Evidence class                           | Status                                                        |
| ---------------------------------------- | ------------------------------------------------------------- |
| Source implementation                    | IMPLEMENTED in current worktree                               |
| Provider-independent AI tests/evaluation | LOCAL VERIFIED; 43/43 tests and 62 cases                      |
| Repository regression gates              | LOCAL VERIFIED across configured browsers                     |
| CI on exact Phase 6 commit               | VERIFIED — run `39622315388` succeeded                        |
| Latency-remediation CI                   | VERIFIED — run `39686740905` succeeded                        |
| Staging remediation revision             | VERIFIED — API and AI at commit `3f11f5c`                     |
| Live LLM provider                        | BLOCKED — 9 requests; deployed remediation failed bounded E2E |
| Alert/email/OAuth/SePay provider proof   | BLOCKED or deferred                                           |
| Backup/Redis/rollback                    | BLOCKED                                                       |

## Local test evidence

| Command                                                    | Result                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                           | pass; 9 workspace projects, lockfile unchanged                                          |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`         | pass                                                                                    |
| `pnpm --filter @farta/api test`                            | 20 files / 92 tests passed                                                              |
| `pnpm --filter @farta/storefront test`                     | 15 files / 50 tests passed                                                              |
| `pnpm --filter @farta/admin test`                          | 5 files / 14 tests passed                                                               |
| `pnpm test:e2e`                                            | 7 files / 65 tests passed after Docker preflight; temporary stack removed               |
| `pnpm build`                                               | pass; sitemap logged unavailable product page while the local API was intentionally off |
| `pnpm audit:prod`                                          | no known production dependency vulnerability                                            |
| `uv sync --frozen`; Ruff check/format; `uv run pytest -ra` | 52 packages; Ruff pass; 43/43 tests passed                                              |
| `E2E_BROWSERS=chromium,webkit pnpm exec playwright test`   | 50 passed / 8 expected skipped; zero failures                                           |
| test-only `/tmp` Firefox wrapper + Playwright config       | 23 passed / 4 expected skipped; zero failures; repository config unchanged              |
| Gitleaks 8.24.3 current tracked/untracked tree             | pass after one documentation false-positive wording fix                                 |
| Gitleaks 8.24.3 full Git history                           | 54 commits scanned; no leaks                                                            |

Initial browser execution found a real accent-folding regression: the router emitted keyword `ao`
instead of canonical `áo`, causing deterministic Product Advisor no-results. The router and its
regression test were fixed. WebKit then exposed a registration hydration race that could reset the
first field; auth inputs now enable only after hydration.

Manual dataset review found one contradictory fixture (`clarify` behavior with `completed` status).
The fixture was corrected and schema/test invariants now reject that contradiction. The first
expanded Python run then reported `42 passed / 1 failed` because the new prompt-injection test
fixture omitted two required `AgentState` fields; the fixture was corrected without weakening an
assertion, and the normal full Python suite passed `43/43`.

Final exact-worktree browser evidence: Chromium + WebKit `50 passed / 8 expected skipped` in 2.8
minutes; Firefox `23 passed / 4 expected skipped` in 1.6 minutes. Aggregate local evidence is
`73 passed / 12 expected skipped`, with zero failures. Visual snapshots include the reviewed
catalog-source label.

Playwright Firefox 157 initially failed before page launch with `Could not find profile folder` on
this macOS host. This matches the macOS TCC app-data identity problem documented in Playwright issue
[#42768](https://github.com/microsoft/playwright/issues/42768). The successful run used a copied
browser bundle and wrapper entirely under `/tmp`, with a distinct test-only application identity;
the checked-in Playwright configuration, assertions, timeouts and original browser cache were not
changed. This is local cross-browser evidence, not exact-commit CI or staging-browser evidence.

Observed non-blocking performance warning: Next.js reported several catalog images as LCP candidates
without `loading="eager"`. This is a Low follow-up and no Lighthouse score is claimed.

## Evaluation evidence

- cases: 62; categories: 14; evaluation provider calls: 0;
- deterministic route accuracy: 1.0;
- tool-selection cases: 45; accuracy: 1.0;
- latest local in-process router sample: p50 `0.007437 ms`, p95 `0.021917 ms`;
- live Gemini: key/model metadata HTTP 200; 7 generate calls; low-thinking control HTTP 200 in
  19.515 seconds; deployed remediated Agent reached its 25-second deadline before a tool call and
  failed closed.

## External configuration required

- approved Gemini Free Tier project, quota/billing evidence, data-policy acceptance and secret;
- alert destination and operational owner;
- email provider, sender domain and staging mailbox;
- SePay Test-mode account and official webhook evidence;
- OAuth launch decision and provider credentials only if brought into launch scope;
- isolated MongoDB restore target, RPO/RTO and maintenance approvals.

## Staging/runtime evidence

Commit `fa02dac877952c352c969cac59b552fb418449fd` was pushed and passed GitHub CI run
`39622315388`. Northflank built the same SHA for API build `positive-pull-6716` and AI build
`noble-bee-885`; both deployments completed. Cloudflare deployed Storefront version
`c03de7bd-cd28-447d-a105-8f647dd8395a` at 100% traffic.

Read-only smoke on 2026-10-21 returned HTTPS 200 for Storefront, Admin and API live/ready.
`robots.txt` remained `Disallow: /`. Targeted Chromium Product Advisor validation passed 4/4 and
exact-commit GitHub staging run `39623763468` passed 27/27 Firefox tests. Provider-off advanced
advice failed closed and deterministic catalog discovery remained functional.

The 2026-10-22 follow-up verified private AI live/ready health, real staging catalog results and a
bounded Gemini test. Default-thinking Agent calls failed closed on `504`/timeout; a low-thinking
control succeeded. Revision `3f11f5c787be0b95a9b494a54b84840214c667be` then deployed low thinking
and bounded 25/60/65-second model/Agent/upstream deadlines to both API and AI. The public end-to-end
flow still reached the first provider-call deadline before any tool execution, so runtime was
returned to provider-off. Post-rollback private AI and public API live/ready checks returned HTTP 200.

## Completion score

Weighted denominator: source/evaluation/security 30, local regression 20, exact-revision
staging/browser 15, live LLM 10, alert/email/OAuth 10, SePay 5, backup/Redis/rollback 10. Score:
**65/100** = 30 source + 20 local regression + 15 exact-revision staging/browser validation. Live
LLM and all external/operational sections remain zero rather than being treated as pass.

## Recommendation

**REMEDIATION REQUIRED — REMAIN ON STAGING.** Provider-off mode may continue. Do not enable a live
LLM, online payment or production traffic from this report.
