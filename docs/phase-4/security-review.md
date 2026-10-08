# Phase 4 security review

Date: 2026-10-08

## Result

No unresolved Critical/High finding was identified in the reviewed Phase 4 scope. This is evidence from source review, the Codex Security diff scan and local automated tests; it is not a production-security certification.

Codex Security scan `59fd272a-906e-4fd1-b12d-09471ea65f2a` reviewed 26/26 inventoried Phase 4D source items and reported zero findings across seven security surfaces. Its immutable snapshot preceded a small notification-idempotency refinement and removal of unflushed worker log buffering found during runtime smoke. Those deltas were manually reviewed; the relevant E2E suite and final gates were rerun afterward. The canonical external report is outside the repository in the Codex scan artifact store.

## Control evidence

| Risk                             | Control and evidence                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cart/Order BOLA                  | owner is derived from customer session or HMAC-bound guest credential; cross-customer and guest tests return safe not-found behavior             |
| STAFF/RBAC bypass                | Admin routes require `STAFF` plus granular `order.read`, `order.update` or `order.cancel`; negative E2E covers missing permission/customer realm |
| CSRF                             | every Admin mutation has session-bound CSRF; E2E rejects missing token                                                                           |
| NoSQL injection                  | strict DTOs, unknown-field rejection, explicit query mapping, escaped bounded search; injection-shaped query is rejected                         |
| Mass assignment                  | mutation DTOs accept status/reason/action/reference only; customer/payment/price/inventory authority is not bindable                             |
| Price/quantity/payment tampering | checkout reprices and reserves server-side; payment/COD amounts come from persisted state                                                        |
| Webhook spoof/replay             | raw-body HMAC, timestamp tolerance, provider-event uniqueness and mismatch recording; Phase 4C E2E covers invalid/stale/concurrent delivery      |
| Invalid state transition         | explicit order/payment state machines plus payment-aware operational rules; invalid/backward tests preserve state                                |
| Inventory race                   | conditional updates and short transactions; last-unit 100-way test produces exactly one order allocation                                         |
| Reservation expiry race          | `ACTIVE`/due predicate, inventory/ledger/state in one transaction; concurrent workers release once                                               |
| Guest order enumeration          | non-sequential code, normalized phone digest, dedicated rate limit and uniform not-found response                                                |
| Sensitive output/logging         | public DTOs exclude internal provider/audit data; worker logs generic errors; raw webhook and secrets are not persisted/logged                   |

## Security scan limitation

The scan reported complete coverage for its immutable snapshot and measured 2,968,543 total tokens (2,960,185 input; 2,901,760 cached input). It warned that the working tree changed during the scan. Post-snapshot source deltas changed `PAYMENT_RECEIVED` idempotency from one event per order to one per order/payment state and restored worker lifecycle/error logging by removing an unflushed Nest log buffer. The payment regression test confirms separate deposit and full-payment events; runtime smoke confirms visible worker start/stop logs.

## Residual risks

- Real SePay Test-mode delivery and deployment-edge proxy behavior remain unverified.
- A polling worker is correct under tested concurrency, but production supervision/backlog alerting is not configured here.
- Notification delivery, retry and dead-letter behavior are not implemented; events remain `PENDING`.
- Admin order search may need an indexed search strategy at large data volume.
- Application controls do not replace upstream DDoS, network isolation, secret management or infrastructure monitoring.
