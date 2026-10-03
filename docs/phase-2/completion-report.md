# Phase 2 completion report

Date: 2026-10-03

Scope: Commerce Core + Admin Catalog Operations

## A. Repository changes

- Added bounded NestJS modules for audit, categories, products, variants, inventory, media and banners.
- Replaced the Admin shell with authenticated operational views for catalog, variants, inventory, media and banners.
- Added public catalog APIs and explicit response read models.
- Added ADR-012/013, API/architecture/security/database documentation and Phase 2 E2E coverage.

## B. Domain architecture

The API keeps separate module/service boundaries. Controllers never mutate inventory or persist raw DTOs. Products remain conceptual fashion items; sellable color/size combinations are variants. Media records are referenced by ID rather than duplicated provider metadata.

## C. Collections and indexes

- `categories`: unique slug, status/sort lookup and bounded parent hierarchy.
- `products`: unique slug, status/category publication queries.
- `product_variants`: unique normalized SKU and product/status lookup.
- `inventories`: unique variant ownership.
- `inventory_transactions`: unique idempotency key and variant/time ledger lookup.
- `media_assets`: unique Cloudinary `publicId`.
- `banners`: status/position/schedule/priority lookup.
- `audit_logs`: resource/action/time lookup; append-only API surface.

Index rationale and invariants are documented in `docs/architecture/catalog-inventory.md`.

## D. API endpoints

Public endpoints provide active categories, products, product detail and scheduled banners under `/api/v1`. Protected staff endpoints provide explicit category/product/variant/inventory/media/banner mutations and audit reads. Exact request/response/error contracts are in `docs/api/catalog.md`.

## E. Admin features

Implemented staff login, dashboard metrics, category creation/listing, product creation/listing, variant creation, inventory adjustment, signed Cloudinary upload/finalization, media listing and banner creation/listing. The Admin uses Phase 1 cookies/CSRF/RBAC and shows loading, empty, validation and safe error states.

## F. Media/Cloudinary

The API issues scoped signed upload parameters and verifies signed Cloudinary responses before creating `MediaAsset`. It validates account URL, image resource type, allowlisted format, dimensions and configured byte limit. Referenced assets cannot be archived. Cloudinary credentials remain server-only.

## G. Inventory consistency

`onHand` and `reserved` are authoritative; `available = onHand - reserved` is derived. Mutations use conditional atomic updates plus a ledger record in one short MongoDB transaction. A repeated idempotency key returns the original logical result rather than applying again.

## H. Security controls

Granular permission guards, session-bound CSRF, strict DTOs, explicit mappings, safe Mongo filters, internal-only banner CTAs, safe public serializers, audit entries and signed media finalization are implemented. The bounded review is `docs/phase-2/security-review.md`.

## I. Test and build evidence

Verified on 2026-10-03:

```text
pnpm format:check                       PASS
pnpm lint                               PASS
pnpm typecheck                          PASS
pnpm test                               PASS
  API                                   10 files / 22 tests
  Admin                                 1 file / 1 test
  Storefront                            1 file / 1 test
pnpm test:e2e                           PASS
  API                                   3 files / 25 tests
pnpm build                              PASS
  API, Admin, Storefront                production builds
```

Phase 1 authentication/session/CSRF/CORS/logging regressions remain part of the same 25-test E2E gate.

## J. Concurrency result

The real MongoDB replica-set E2E test initializes one available unit and issues 100 concurrent reservations. Result: 1 fulfilled, 99 rejected, final `onHand=1`, `reserved=1`, `available=0`.

## K. Performance observations

Public list queries are paginated and projected into bounded read models. Media/category/variant hydration is batched per result set rather than queried per card. Admin's current single bundle is 466.61 kB raw / 144.63 kB gzip; route splitting is a future optimization, not a correctness blocker.

## L. Known limitations

- Live Cloudinary credentials/provider upload were not available for runtime verification.
- Rich product-editor operations such as bulk variant matrix editing and drag reorder are not included; the existing forms cover the authoritative API operations.
- Automated orphan-media/provider deletion is intentionally deferred.
- No browser automation or exploit-validated penetration test ran in this phase.
- Public global price sorting is not advertised because the current aggregate read model cannot guarantee correct cross-page ordering without a deliberate query redesign.

## M. External configuration

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and optionally `CLOUDINARY_UPLOAD_MAX_BYTES` in the server secret store. Never expose the API secret through Vite/Next public variables.

## N. ADR changes

- ADR-012: publication invariant and integer VND representation.
- ADR-013: signed direct upload/finalization and append-only inventory ledger.

## O. Phase 3 readiness

The public catalog supplies real categories, products, variants, semantic availability and scheduled banner media. Phase 3 can build the storefront through the API boundary without reading MongoDB or inventing catalog data.
