# Phase 3 defensive security review

Date: 2026-10-06

## Scope and evidence

Reviewed storefront catalog/auth/account code, Next.js configuration, public serialization, URL/query mapping and Phase 1/2 regression gates. Evidence is source inspection, unit/API E2E/build gates, response-header smoke checks and runtime route checks.

| Area                 | Result                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS/CMS content      | Product, category and banner text render as React text. No CMS HTML renderer exists. Product JSON-LD uses an explicit object serialized with `<` escaped.                                             |
| URL safety           | Banner CTAs are already restricted to internal paths by Phase 2. Route slugs are encoded before API calls. Catalog URL state maps only explicit scalar fields.                                        |
| NoSQL/resource abuse | Browser query parameters never become Mongo expressions. Search/filter lengths, numeric ranges, page and result limit are bounded before API requests; the API retains its DTO/sanitization controls. |
| Client exposure      | Public DTOs omit actor, audit, ledger and exact inventory data. Account/session UI does not expose token hashes or raw credentials.                                                                   |
| Auth/CSRF            | Customer mutations use same-origin cookie requests and the Phase 1 CSRF token/header contract. No bearer token is written to localStorage.                                                            |
| BOLA/RBAC            | Storefront adds no direct resource-ID authorization path. Existing auth/session and Admin E2E regression suites remain passing. Orders are not implemented or faked.                                  |
| Remote images        | `next/image` allowlists only the configured Cloudinary account path and follows zero redirects. Unrecognized remote URLs are not passed to the optimizer.                                             |
| CSP/headers          | CSP restricts default/connect/media/frame/object/base/form sources; HSTS is production-only. `unsafe-eval` is development-only. COOP, referrer, MIME and permissions policies are set.                |
| Indexing             | Non-production and production without an explicit `NEXT_PUBLIC_INDEXABLE=true` remain `noindex`. Sitemap data comes only from active public APIs.                                                     |
| Error handling       | Catalog failures map to safe unavailable/not-found UI; server internals and stack traces are not rendered.                                                                                            |

## Residual risks

- The static CSP currently requires `unsafe-inline` for Next.js inline runtime/style output and data-driven color swatches. A nonce-based CSP was not adopted because the documented Next.js nonce model forces dynamic rendering and would remove the selected ISR/CDN behavior. This is a documented hardening trade-off, not a claim of strict CSP.
- Production OAuth providers, Cloudinary delivery and canonical deployment headers were not exercised because credentials/deployment targets were not supplied.
- No exploit-driven browser penetration test or third-party SAST scanner ran in this phase.
- `NEXT_PUBLIC_SITE_URL`, Cloudinary account and indexability flags must be configured per environment; defaults fail closed for indexing and remote images.

No unresolved Critical/High issue was identified in the implemented Phase 3 scope. This bounded review does not establish that the application is vulnerability-free.
