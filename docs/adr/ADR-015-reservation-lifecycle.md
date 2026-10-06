# ADR-015: Reservation lifecycle

Status: Accepted

## Decision

Checkout uses a durable `inventory_reservations` aggregate. A checkout transaction creates all reservation rows, conditionally increments every affected `inventory_items.reserved`, appends `RESERVE` ledger entries, creates the immutable order/payment records and moves the new reservations from `ACTIVE` to `CONFIRMED` before commit.

Allowed transitions are:

- `ACTIVE → CONFIRMED`: the order snapshot was committed.
- `ACTIVE → RELEASED`: an explicit pre-confirmation compensation released stock.
- `ACTIVE → EXPIRED`: the configured deadline passed and an expiry worker atomically released stock.
- `ACTIVE → CANCELLED`: checkout was explicitly abandoned before confirmation.
- `CONFIRMED → RELEASED`: an allowed order cancellation released stock before sale.

`RELEASED`, `EXPIRED` and `CANCELLED` are terminal. `CONFIRMED` remains the historical allocation state after a later `SALE` ledger entry; it is never expired by a worker. Every release matches the current reservation state and updates inventory plus ledger in one short MongoDB transaction.

`InventoryService` exposes session-aware batch primitives. Checkout must not call the standalone Phase 2 `reserve()` method once per item because that method owns its own transaction and was only a concurrency proof.

## Consequences

- Reservation TTL is typed configuration, not a service literal.
- Duplicate expiry/release workers have one effective mutation.
- No provider HTTP, email or Cloudinary call occurs inside an inventory transaction.
