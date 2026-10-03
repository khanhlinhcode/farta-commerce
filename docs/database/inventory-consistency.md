# Inventory consistency design

## State

`InventoryItem` stores `onHand`, `reserved`, `sold`, `version` for one variant. Available stock is `onHand - reserved`; it is calculated server-side and must never be negative.

`InventoryLedger` is append-only with types:

- `IMPORT`
- `RESERVE`
- `RELEASE`
- `SALE`
- `RETURN`
- `ADJUSTMENT`

Every event records variant, signed quantity, actor/system source, reason/reference, idempotency key, request ID and timestamp.

## Reservation algorithm

1. Start a MongoDB transaction.
2. Upsert/claim a unique reservation command by idempotency key.
3. Atomically update the inventory item with a server-built condition that available quantity is sufficient and increment `reserved`.
4. Insert matching ledger and reservation records.
5. Commit; return a domain conflict on insufficient stock or retryable transaction conflict.

No read-modify-write in application memory is permitted for stock allocation.

## Reservation lifecycle

`ACTIVE → CONSUMED` on confirmed sale.  
`ACTIVE → RELEASED` on cancellation/failure.  
`ACTIVE → EXPIRED` by an idempotent reconciliation worker.

Release/consume operations match the current reservation status so retries cannot double-release or double-sell.

## Required concurrency proof

Given `onHand=1` and `reserved=0`, 100 simultaneous one-unit reservation attempts for distinct requests must yield exactly one success and 99 inventory conflicts, with `reserved=1` and one `RESERVE` ledger record. Run this against a real replica-set MongoDB, not an in-memory mock.

## Reconciliation

A scheduled job detects expired active reservations and aggregate/ledger mismatches. It reports anomalies; it does not silently rewrite history. Manual correction uses an audited `ADJUSTMENT` command.
