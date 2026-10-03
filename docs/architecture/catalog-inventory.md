# Catalog and inventory architecture

Date: 2026-10-03

## Domain boundaries

- `CategoriesModule` owns bounded category hierarchy, public navigation and slug uniqueness.
- `ProductsModule` owns conceptual fashion products, publication invariants and public read models.
- `VariantsModule` owns sellable color/size combinations and globally unique normalized SKU values.
- `InventoryModule` is the only stock mutation boundary. Controllers and product services cannot edit stock directly.
- `MediaModule` owns Cloudinary authorization/finalization and reference-aware archival.
- `BannersModule` owns safe internal CTA values, schedules, positions and priority.
- `AuditModule` provides append-only administrative evidence.

## Money

All authoritative VND values are safe non-negative integers. `299000` means `299,000 VND`; no floating-point amount or implicit decimal conversion is accepted. Public and admin DTOs include `currency: VND` where price is presented.

## Publication invariant

A public product must have:

1. `ACTIVE` status and no archive timestamp;
2. at least one active category;
3. a non-archived Cloudinary image as cover media;
4. at least one active variant with a valid integer price.

Draft, inactive and archived records are excluded by the public API.

## Inventory invariant

`onHand` and `reserved` are authoritative. `available = onHand - reserved` is derived and must never be stored as an independently editable value. Every mutation uses a MongoDB transaction containing the conditional inventory update and append-only `InventoryTransaction`. Admin adjustments also include the audit record in that transaction.

Reservation uses a server-built `$expr` condition and atomic `$inc`; it never performs application-memory read/modify/write. Idempotency is enforced by the unique `(type, idempotencyKey)` index.

## Search and pagination

Public filters are an explicit DTO: `q`, `category`, `size`, `color`, `minPrice`, `maxPrice`, `availability`, `page`, `limit`, `sort`. Search is capped at 100 characters and escaped before regex construction. Page size is capped at 100. Phase 2 exposes only authoritative `newest` sorting; price sorting is deferred until a global aggregation/cursor design is implemented.
