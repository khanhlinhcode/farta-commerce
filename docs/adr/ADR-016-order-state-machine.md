# ADR-016: Order state machine and snapshots

Status: Accepted

## Decision

Orders store immutable item, recipient, shipping, price and media snapshots. The public order code is generated from cryptographically random bytes with a human-readable prefix and a database unique index; it is not a sequence or encoded MongoDB identifier.

Normal transitions are `CREATED → CONFIRMED → PACKING → SHIPPING → DELIVERED → COMPLETED`. `CREATED` and `CONFIRMED` may move to `CANCELLED` under the configured cancellation policy. `CREATED` or `CONFIRMED` may enter `PAYMENT_CONFLICT`; an explicit audited reconciliation may return it to `CONFIRMED` or cancel it. No generic status update endpoint exists.

Order and payment states are separate. COD selection leaves payment `UNPAID`; collection metadata is written only through an authorized operational command.

Customer APIs derive ownership from the verified session. Guest lookup requires the order code plus normalized recipient phone, returns a restricted view, uses an enumeration-safe response and has a dedicated rate limit.

## Consequences

- Product archival or later price/media changes cannot rewrite purchase history.
- Each transition is an allowlisted domain command with state preconditions, permission/policy checks and audit evidence.
- Customer cancellation after `CONFIRMED`, and every cancellation from `PACKING` onward, is denied until stakeholder policy explicitly broadens it.
