# Catalog API v1

Date: 2026-10-03

All endpoints use the Phase 1 error envelope and validation policy. Mutations require the staff realm, session-bound CSRF and listed permission.

## Public

- `GET /api/v1/categories`
- `GET /api/v1/categories/:slug`
- `GET /api/v1/products`
- `GET /api/v1/products/:slug`
- `GET /api/v1/banners?position=home-hero`

Public DTOs exclude actor IDs, ledger data, exact stock and audit records. Product availability is `IN_STOCK`, `LOW_STOCK` or `OUT_OF_STOCK`. Product filters are bounded and reject unknown properties/Mongo operators.

## Admin catalog

- `/api/v1/admin/categories`: list, create, update, archive
- `/api/v1/admin/products`: list, create, update/publish, archive
- `/api/v1/admin/products/:productId/variants`: list, create, update, archive
- `GET /api/v1/admin/inventory/:variantId`
- `PATCH /api/v1/admin/inventory/:variantId/adjustments`
- `GET /api/v1/admin/media`
- `POST /api/v1/admin/media/upload-authorizations`
- `POST /api/v1/admin/media/finalize`
- `DELETE /api/v1/admin/media/:mediaId`
- `/api/v1/admin/banners`: list, create, update/publish, archive
- `GET /api/v1/admin/audit-logs`

Inventory adjustment requires an `Idempotency-Key` header of 8–160 characters. The request body accepts only `quantityDelta` and `reason`; final stock is never accepted from the client.

## Selected errors

`CATEGORY_SLUG_CONFLICT`, `CATEGORY_CYCLE`, `PRODUCT_SLUG_CONFLICT`, `PRODUCT_PUBLICATION_INVALID`, `VARIANT_SKU_CONFLICT`, `VARIANT_PRICE_INVALID`, `INSUFFICIENT_STOCK`, `MEDIA_SIGNATURE_INVALID`, `MEDIA_IN_USE`, `BANNER_CTA_UNSAFE`, `INVALID_BANNER_SCHEDULE`.
