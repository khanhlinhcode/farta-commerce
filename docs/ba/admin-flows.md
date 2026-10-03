# Admin business flows

## Access

1. Staff accounts are provisioned by an authorized `OWNER`/`ADMIN` workflow or controlled seed command that refuses production.
2. Staff authenticates through the admin realm; customer sessions are rejected.
3. API resolves role/permissions server-side on every privileged request.
4. Sensitive actions expose a future step-up/MFA hook and always emit audit events.

## Catalog

```mermaid
flowchart LR
  Draft[Create product draft] --> Variants[Define options and variants]
  Variants --> Media[Attach ordered media]
  Media --> Validate[Validate SKUs, prices and merchandising]
  Validate --> Publish[Publish]
  Publish --> Archive[Archive; do not hard-delete referenced products]
```

- SKU uniqueness is enforced by the database.
- Product status and variant status are independent but validated as a coherent sellability rule.
- Price changes are audited with safe before/after summaries.

## Inventory

- Operators never edit a stock number directly.
- They create an `InventoryLedger` event through `InventoryService` with reason/reference.
- Reservation, sale, release and return are system transitions; manual `ADJUSTMENT` requires permission and audit.
- Concurrency conflicts return a domain error and never oversell.

## Orders and customers

- Order transitions use allowed commands (`confirm`, `pack`, `ship`, `deliver`, `complete`, `cancel`) rather than arbitrary status updates.
- Customer access is purpose-limited and audited; secret credentials and token hashes are never returned.
- Refund/payment corrections require payment-specific permission and preserve immutable provider references.

## Media and banners

- Uploads pass server-issued policy and validation before becoming selectable assets.
- Deletion checks references; referenced assets are archived or replaced first.
- Banner scheduling validates time ranges, positions, priorities and separate desktop/mobile assets.

## Roles and audit

- Only `OWNER` can grant `OWNER` or change owner-critical policy.
- Role/permission edits are explicit allowlisted mutations with self-lockout protection.
- Audit logs are append-only to normal application actors and filterable by actor/action/resource/request ID.
