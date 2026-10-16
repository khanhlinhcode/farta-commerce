# Release remediation plan

Date: 2026-10-16

This plan is an evidence freeze for the current local repository at `9b59c5e` (two commits ahead of `origin/main`). It does not claim staging or provider readiness. Existing browser-test users and orders are retained until a stakeholder approves a separately reviewed cleanup operation.

## Baseline evidence

- Frozen install, format, lint and typecheck passed.
- Package tests passed when run sequentially: API 77, Storefront 25, Admin 12. The initial parallel workspace run produced three timeouts that did not reproduce in focused or sequential reruns.
- API E2E passed: 64 tests.
- API, Admin and Storefront production builds passed with `API_INTERNAL_URL=http://127.0.0.1:4000`.
- Production dependency audit reported no known vulnerabilities.
- AI scaffold checks passed: Ruff and 8 Pytest tests.

## Finding map

| Group                   | Expected behavior                                                          | Main boundary                                                      | Tests/evidence                                              | Migration/external impact                                           |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| A Related Products      | Public products expose safe category summaries and PDP filters by slug     | Product public read model and PDP only                             | API DTO/enrichment and PDP tests                            | Backward-compatible response addition; no migration                 |
| B Auth and Cart merge   | Authentication remains successful when post-auth Cart merge fails          | Storefront auth orchestration; Cart rules unchanged                | login/register merge success, conflict and network failure  | No dependency or migration                                          |
| C Profile/onboarding    | Customer updates only `displayName`; completion persists idempotently      | Customer auth controller/service with principal ownership and CSRF | allowlist, BOLA, unknown fields, repeat completion          | Existing user fields only; no schema migration expected             |
| D Password recovery     | Enumeration-safe, one-use, expiring token; all sessions revoked            | Customer auth, Redis token digest and notification outbox          | hash/expiry/reuse/enumeration/session revocation            | Email delivery remains external; no provider SDK will be added      |
| E Google/Apple OAuth    | Real provider-validated OIDC only                                          | Existing OAuth transaction boundary                                | provider integration/security tests after credentials exist | Blocked on official configuration and credentials                   |
| F Product price display | Exact price or truthful range; no cross-variant compare price              | Storefront ProductCard presentation                                | component cases for uniform/ranged/discounted variants      | No migration                                                        |
| G Media integrity       | Product/Variant/Category image fields accept only active images            | API domain validation and Admin picker filtering                   | unknown, archived, wrong-type and mixed-array tests         | Historical invalid records reported, not rewritten                  |
| H Admin operations      | Bounded CRUD/publish/archive workflows using existing APIs and permissions | Feature-oriented Admin modules                                     | form, permission and mutation tests                         | No new state framework or dependency                                |
| I Admin accessibility   | Labels, errors, focus and confirmations are programmatic                   | Existing Admin forms/dialogs                                       | component keyboard and error-association tests              | No migration                                                        |
| J Mobile filters        | Apply/Clear close and restore trigger focus                                | Storefront filter drawer                                           | component focus/scroll-lock/back-forward tests              | No migration                                                        |
| K Sitemap               | All active public products are included through bounded paging             | Next.js to public API                                              | 101+ items, failure and deduplication tests                 | No direct database access                                           |
| L Catalog query         | Product-page work is bounded and filter semantics stay accurate            | Product public read query                                          | larger fixture and query-shape observations                 | Index/ADR only if query design requires it                          |
| M Images/LCP            | Context-accurate `sizes`; only real above-fold candidates eager            | Storefront media callers                                           | component/browser warning review                            | No new carousel/image dependency                                    |
| N Image accessibility   | Decorative alternate image is silent; color names are exposed              | ProductCard                                                        | accessible-name tests                                       | No migration                                                        |
| O Browser isolation     | Release runs use the current revision and test-owned data                  | Playwright config and test data lifecycle                          | repeated/interrupted run guards                             | Existing records are not deleted without approval                   |
| P Next generated drift  | Dev/build gates do not leave tracked generated-file churn                  | Storefront Next configuration/tracking policy                      | build/dev plus clean-worktree check                         | Must follow locked Next 16.3.8 behavior                             |
| Q CSP                   | Reduce inline-script/style risk without breaking rendering                 | Next headers/rendering                                             | production header/hydration checks                          | Nonce rendering rewrite requires explicit approval if material      |
| R Notifications         | Idempotent bounded delivery and observable failure                         | Existing transactional outbox                                      | retry/idempotency tests once provider is approved           | Blocked on provider/worker approval; no SDK or queue added silently |

## Implementation order

1. Correctness and presentation: A, B, F, G, J, K, M, N.
2. Customer-owned account workflows: C and D using existing auth, Redis and outbox boundaries.
3. Admin operational completion and accessibility: H and I.
4. Bounded catalog query, browser isolation and generated-file policy: L, O and P.
5. CI/documentation and focused regression gates.
6. External subphases E and R, staging validation and any material CSP rendering change remain blocked until their stated inputs or approvals exist.

## Hard boundaries

- No production dependency, database schema migration, destructive data cleanup, provider credential use, deploy or push is authorized by this plan.
- No changes may weaken realm separation, session rotation, CSRF, RBAC/BOLA, server-authoritative money, Cart ownership, checkout idempotency, inventory/reservation consistency, payment verification or log redaction.
- Historical phase reports remain unchanged.
