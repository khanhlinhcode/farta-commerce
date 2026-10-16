# MongoDB schema design

This is a logical Phase 0 model. Field names may be refined through DTO/schema implementation, but security and consistency constraints are binding.

## Identity collections

### `users`

`_id`, normalized `email`, `emailVerifiedAt`, `passwordHash?`, `displayName`, `roles[]`, `rolesVersion`, `status`, `onboardingCompletedAt?`, timestamps.

- Unique partial index on normalized email.
- Response serializers exclude password hash and internal status metadata.
- Public registration maps an allowlist and fixes role to `CUSTOMER`.

### `external_identities`

`userId`, `provider`, `providerSubject`, verified provider email snapshot, timestamps.

- Unique `{ provider, providerSubject }`.
- Provider tokens are not persisted unless a later provider feature has an explicit encrypted-at-rest need.

### `sessions`

`userId`, `realm`, `familyId`, `refreshDigest`, `rotationCounter`, `rolesVersion`, safe device label, IP prefix/hash where justified, `lastActivityAt`, `idleExpiresAt`, `absoluteExpiresAt`, `revokedAt`, `revocationReason`, timestamps.

- Index active sessions by `{ userId, realm, revokedAt, absoluteExpiresAt }`.
- Rotation updates match `_id + refreshDigest + revokedAt:null` atomically.

### `password_reset_tokens`

`userId`, keyed `tokenDigest`, `expiresAt`, `consumedAt`, timestamps. TTL cleanup is convenience; application checks expiry and consumption authoritatively.

Implementation status (2026-10-16): planned only. No collection/schema is registered in the application yet. Adding it and extending the transactional notification outbox requires stakeholder approval and migration/index review.

## Commerce collections

| Collection               | Purpose                                | Critical constraints/indexes                          |
| ------------------------ | -------------------------------------- | ----------------------------------------------------- |
| `categories`             | hierarchical merchandising taxonomy    | unique slug; bounded acyclic parent chain             |
| `products`               | product-level editorial/catalog data   | unique slug; status/published indexes                 |
| `product_variants`       | sellable SKU/color/size combinations   | unique SKU; unique product option signature           |
| `inventory_items`        | per-variant aggregate stock            | unique variant; nonnegative invariants                |
| `inventory_ledger`       | append-only stock events               | unique idempotency/reference key where applicable     |
| `inventory_reservations` | checkout/order reservations            | unique reservation key; expiry/status indexes         |
| `carts`                  | guest/customer cart state              | unique active owner key; optimistic version           |
| `orders`                 | immutable snapshots + controlled state | unique order number and checkout idempotency key      |
| `payments`               | provider-neutral payment records       | unique provider transaction/event IDs                 |
| `idempotency_records`    | mutation replay binding                | unique realm/owner/operation/key; TTL after retention |
| `payment_webhook_events` | authenticated provider event evidence  | unique provider/event ID; status/received time        |
| `media_assets`           | Cloudinary metadata/reference state    | unique publicId; reference/deletion state indexes     |
| `banners`                | scheduled campaigns                    | status/position/time indexes                          |
| `audit_logs`             | append-only privileged event evidence  | actor/action/resource/time/request indexes            |

Phase 4B physical collection names are `carts`, `idempotency_records`, `inventory_reservations`, `orders`, `payments`, `inventory` and `inventory_transactions`. Important implemented indexes include unique active cart ownership, unique owner/operation/idempotency key, reservation status/expiry, unique public order code, customer/time order listing, unique order/idempotency linkage, unique payment/order linkage and partial unique provider transaction ID.

## General rules

- Schemas use strict mode and explicitly reject keys such as `$*`, `__proto__`, `constructor` and `prototype` before query construction.
- API DTOs and persistence schemas are separate. DTOs are explicitly mapped into create/update commands.
- Money is integer minor units plus ISO currency, never binary floating point.
- Timestamps are UTC instants. Business display timezone is a presentation concern.
- Soft archive is preferred where records are referenced by orders/audit; hard deletion is exceptional and auditable.
- Multi-document transactions require a MongoDB replica set in development, test and production.
