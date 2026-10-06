# Phase 4 failure matrix

| Failure                                               | Authoritative outcome                                                  | Recovery/observability                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Preview price differs from cart projection            | no mutation; return `CHECKOUT_PRICE_CHANGED` with current safe preview | customer confirms current price                  |
| Any checkout stock condition fails                    | transaction aborts; no order/reservation/ledger delta                  | `INSUFFICIENT_STOCK`, conflict metric            |
| Checkout request times out after commit               | retry same key/hash returns same order                                 | idempotency result lookup                        |
| Same key with different body                          | no mutation                                                            | HTTP 409 and security event                      |
| Ledger/order/reservation insert fails                 | entire transaction aborts                                              | safe error/request ID; retry possible            |
| Browser closes after order commit                     | order remains queryable                                                | account/guest lookup                             |
| Provider initiation times out                         | payment remains pending/unpaid                                         | same logical initiation retry; reconciliation    |
| Frontend returns “success” without webhook            | no paid transition                                                     | bounded polling shows pending                    |
| Invalid or stale SePay HMAC timestamp                 | no event record/domain mutation                                        | safe 401, metric without payload secrets         |
| Duplicate/concurrent webhook                          | one event claim and transition                                         | duplicates return accepted after existing result |
| Amount/currency/reference mismatch                    | no paid transition; payment/order conflict                             | Admin reconciliation queue and audit             |
| Reservation expires before verified payment           | attempt atomic reallocation; if unavailable, `PAYMENT_CONFLICT`        | human reconciliation; no silent refund           |
| Order created, notification fails                     | order unaffected                                                       | idempotent pending outbox retry                  |
| Cancellation release retried                          | one state transition/ledger release                                    | same result/no-op                                |
| Expiry workers race                                   | one worker wins current-state update                                   | losing worker no-op; metric                      |
| Audit/outbox insert inside critical transaction fails | critical state transaction aborts                                      | retry command; no unaudited privileged mutation  |

No recovery path holds a MongoDB transaction across provider HTTP, email or Cloudinary calls.
