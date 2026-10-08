# Phase 4 final failure matrix

Date: 2026-10-08

| Failure or race                                        | Authoritative result                                                                   | Recovery and evidence                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Cart/catalog price changes before submit               | no reservation/order; `CHECKOUT_QUOTE_CHANGED`                                         | return current authoritative preview                  |
| Two or 100 buyers compete for the last unit            | one conditional reservation succeeds; no negative inventory                            | 100-way MongoDB-backed E2E: 1 success, 99 conflicts   |
| Browser double-submits checkout                        | one logical order/reservation set                                                      | owner/operation/key/request-hash idempotency          |
| Checkout transaction fails after an intermediate write | no partial order, payment, reservation or ledger delta                                 | rollback E2E                                          |
| Browser closes after commit                            | durable order remains available                                                        | account orders or verified guest lookup               |
| Frontend returns from payment without webhook          | payment remains pending                                                                | bounded authoritative polling                         |
| Forged/stale/duplicate SePay event                     | rejected or one effective transition                                                   | HMAC/timestamp/event identity E2E                     |
| Signed event amount/account/reference is wrong         | no paid transition; explicit conflict                                                  | Admin reconciliation surface and audit                |
| Paid order cannot be fulfilled                         | `PAYMENT_CONFLICT`; no silent stock creation/refund                                    | human reconciliation                                  |
| Staff tries invalid/backward order transition          | HTTP 409, no mutation                                                                  | explicit state-machine E2E                            |
| Shipping command is retried/concurrent                 | one `SALE` ledger mutation and one state transition                                    | transactional state check plus ledger identity        |
| Cancellation is retried                                | one release/cancel transition                                                          | state predicate and idempotent E2E                    |
| Paid conflict is cancelled before refund               | cancellation rejected                                                                  | `REFUND_PENDING → REFUNDED` record required first     |
| COD is selected                                        | payment stays `UNPAID`                                                                 | collection is a separate delivered/completed command  |
| COD collection is retried/concurrent                   | one `FULLY_PAID` transition                                                            | payment state predicate and MongoDB transaction       |
| Reservation expiry workers race                        | one release and `EXPIRED`; losing worker no-op                                         | concurrent worker E2E                                 |
| MongoDB transaction callback retries                   | business effects stay idempotent; local released metric counts committed callback only | callback-local marker reset                           |
| Notification provider unavailable                      | order/payment transaction still commits with `PENDING` intent                          | durable outbox; delivery not claimed                  |
| Same notification action is retried                    | unique semantic key prevents duplicates                                                | payment deposit/final receipts remain separate states |
| Audit or outbox insert fails in critical command       | whole command transaction aborts                                                       | no unaudited privileged mutation                      |
| Worker process stops                                   | due reservations remain queryable and are retried after restart                        | supervisor alerting required in deployment            |

No database transaction spans SePay, email, Cloudinary or another external network call.
