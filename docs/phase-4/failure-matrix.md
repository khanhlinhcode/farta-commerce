# Phase 4 failure matrix

| Failure                                               | Authoritative outcome                                                  | Recovery/observability                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Preview price differs from cart projection            | no mutation; return `CHECKOUT_PRICE_CHANGED` with current safe preview | customer confirms current price                  |
| Any checkout stock condition fails                    | transaction aborts; no order/reservation/ledger delta                  | `INSUFFICIENT_STOCK`, conflict metric            |
| Checkout request times out after commit               | retry same key/hash returns same order                                 | idempotency result lookup                        |
| Same key with different body                          | no mutation                                                            | HTTP 409 and security event                      |
| Ledger/order/reservation insert fails                 | entire transaction aborts                                              | safe error/request ID; retry possible            |
| Browser closes after order commit                     | order remains queryable                                                | account/guest lookup                             |
| Payment instruction request is interrupted            | payment remains pending/unpaid; no new attempt is created              | repeat owner-bound initiation                    |
| Frontend returns “success” without webhook            | no paid transition                                                     | bounded polling shows pending                    |
| Invalid or stale SePay HMAC timestamp                 | no event record/domain mutation                                        | safe 401, metric without payload secrets         |
| Duplicate/concurrent webhook                          | one event claim and transition                                         | duplicates return accepted after existing result |
| Same provider event ID with different signed payload  | original result remains; mismatched replay is rejected                 | anomaly counter/time retained for reconciliation |
| Amount/currency/reference mismatch                    | no paid transition; payment/order conflict                             | Admin reconciliation queue and audit             |
| Reservation/payment window expires before receipt     | no reallocation or paid transition; explicit `PAYMENT_CONFLICT`        | human reconciliation; no silent refund           |
| Order created, notification fails                     | order unaffected                                                       | idempotent pending outbox retry                  |
| Cancellation release retried                          | one state transition/ledger release                                    | same result/no-op                                |
| Expiry workers race                                   | one worker wins current-state update                                   | losing worker no-op; metric                      |
| Audit/outbox insert inside critical transaction fails | critical state transaction aborts                                      | retry command; no unaudited privileged mutation  |

No recovery path holds a MongoDB transaction across provider HTTP, email or Cloudinary calls.
