# ADR-013: Verified media finalization and inventory ledger

Status: Accepted

Admin media uses browser-to-Cloudinary signed uploads with server-side response-signature verification before persistence. Provider deletion is separated from reference-aware database archival.

Inventory stores `onHand` and `reserved`; `available` is derived. Mutations use conditional MongoDB updates plus an append-only ledger inside short transactions. Idempotency keys and database uniqueness make retries safe. No network call occurs inside an inventory transaction.
