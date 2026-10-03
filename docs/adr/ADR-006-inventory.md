# ADR-006: Inventory consistency

Status: Accepted

Inventory changes occur only through `InventoryService`, an append-only ledger and atomic/transactional aggregate updates. Reservations have explicit lifecycle and idempotency. Direct stock edits and application-memory read/modify/write are forbidden.
