# Phase 5A staging security hardening report

Date: 2026-10-14

Status: implemented and gated locally; deployment validation pending

## A. Baseline revision

Work started from synchronized revision `8c424c0` (`docs: record phase 5 staging readiness`) with a clean worktree and `origin/main...HEAD` equal to `0 0`.

## B. Security finding

Readiness finding P5-B01 identified that `staging` inherited development behavior for authentication and guest-cart cookies, Helmet CSP/HSTS, HTTPS-origin validation, log verbosity and AI-to-API transport. A public staging deployment with that policy would not be an acceptable production-like security boundary.

## C. Root cause

Security-sensitive services independently checked only `APP_ENV === "production"`. The duplicated condition excluded `staging` and allowed the implementations to drift. Mongoose auto-index creation also treated staging as a local environment.

## D. Environment policy

A typed `isDeployedEnvironment` policy now classifies:

- `development` and `test` as local environments;
- `staging` and `production` as deployed environments.

Security-sensitive API services reuse this policy. No dependency was added and no commerce-domain invariant changed.

## E. Cookie behavior

In staging and production:

- customer/staff access cookies are `Secure`, `HttpOnly`, host-only and `__Host-` prefixed;
- restricted-path refresh cookies are `Secure`, `HttpOnly` and `__Secure-` prefixed;
- synchronizer CSRF cookies are `Secure`, client-readable and `__Secure-` prefixed;
- guest-cart cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, host-only and `__Host-` prefixed;
- clear operations repeat the issuing names, paths and security attributes;
- Customer and Staff realms retain separate namespaces.

Development and test retain their unprefixed local HTTP cookies.

## F. HTTPS and configuration validation

Staging and production now require HTTPS for `APP_ORIGIN`, `ADMIN_ORIGIN` and `API_ORIGIN`. Placeholder application secrets and development OWNER bootstrap values are rejected without echoing their values. SePay remains validly disabled without payment credentials; existing complete-or-disabled Google, Apple and Cloudinary rules are unchanged.

## G. HTTP security behavior

Staging and production now receive explicit Helmet configuration:

- CSP defaults to no resource loading for the JSON API and disallows base, form and frame ancestors;
- HSTS uses a one-year max age with subdomains;
- `X-Content-Type-Options: nosniff` is enabled;
- frame embedding is denied;
- Referrer Policy remains `strict-origin-when-cross-origin`.

Development and test keep CSP/HSTS disabled for deterministic local execution while retaining no-sniff, frame and referrer protections. CORS remains an exact Storefront/Admin origin allowlist and `TRUST_PROXY_HOPS` remains explicitly bounded.

## H. Logging and database behavior

Staging and production now default to `info` logging; development and test remain at `debug`. Redaction coverage includes browser credentials, password/token fields, database and Redis URIs, JWT/CSRF/Cart/Order secrets, OAuth/Apple credentials, Cloudinary and SePay secrets.

Mongoose automatic index creation is disabled in staging and production. Development retains its direct local replica-set connection; no direct-connection behavior is injected into staging.

## I. AI configuration

FastAPI settings now require `AI_API_BASE_URL` to use HTTPS when `AI_APP_ENV` is `staging` or `production`. Local development and test may use HTTP. No AI commerce route, database access or agent capability was added.

## J. Tests added or expanded

Coverage includes:

- secure staged authentication, CSRF and guest-cart cookies;
- realm isolation and matching cookie clearing;
- deployed versus local HTTP-security options;
- all three staging origin fields;
- staging placeholder and bootstrap rejection;
- disabled SePay staging configuration;
- deployed logging level and expanded secret redaction;
- deployed Mongoose auto-index behavior;
- AI staging/production HTTPS and local HTTP behavior.

## K. Actual gate results

| Gate                               | Result                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Frozen pnpm install                | lockfile current across 9 workspace projects                                                                                        |
| Format, lint and typecheck         | passed                                                                                                                              |
| API unit                           | 16 files / 77 tests passed                                                                                                          |
| Storefront unit/component          | 6 files / 18 tests passed                                                                                                           |
| Admin unit/component               | 4 files / 12 tests passed                                                                                                           |
| API E2E/security/concurrency       | 7 files / 64 tests passed                                                                                                           |
| Production build                   | API, Admin and Storefront passed; Storefront generated 19 static pages                                                              |
| Production dependency audit        | no known vulnerability at the configured `high` threshold                                                                           |
| Chromium Browser E2E               | 20 tests passed in approximately 1.4 minutes; snapshots were not updated                                                            |
| Python frozen sync / Ruff / Pytest | passed / passed / 8 tests passed                                                                                                    |
| Diff and secret scan               | `git diff --check` passed; Gitleaks 8.24.3 found no leaks in the full pre-commit history or approximately 42 KB changed-file stream |

## L. Remaining deployment validation

P5-B01 is resolved locally but is not closed as deployed evidence. Staging must still confirm TLS termination, exact proxy-hop trust, secure-cookie acceptance, forwarded protocol behavior, HSTS/CSP responses and exact CORS against canonical domains.

## M. Known limitations

- No staging resource or provider-specific manifest was created.
- Local test headers validate configured policy, not an external CDN/proxy response.
- HSTS preload is not enabled.
- CI Browser E2E still lacks an approved reproducible non-production MediaAsset bootstrap.
- Local signed SePay fixtures are not real Test-mode delivery evidence.

## N. Unresolved provider inputs

The project still needs approved hosting and domains, managed MongoDB/Redis, a secret store, Cloudinary staging, SePay Test mode and public webhook, OAuth applications, transactional email, monitoring/error tracking and a staging-data policy. Secrets must be entered directly into provider secret stores and never committed or sent through chat.

## Conclusion

The provider-neutral staging security gap is remediated with local regression evidence. Phase 5A makes no staging or production-readiness claim and stops before provider selection or deployment.
