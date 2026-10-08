# Phase 4 performance review

Date: 2026-10-08

## Result

No unbounded pagination, obvious order-list N+1 query, or external network call inside a MongoDB transaction was found in Phase 4D. These are local test timings, not production throughput or latency claims.

## Measured local evidence

Environment: local Node/Vitest against the Docker MongoDB replica set and Redis. Vitest's verbose duration includes test setup and all operations in each named scenario, so it is an upper-level scenario duration rather than a single-request percentile.

| Representative scenario                        | Observed duration |
| ---------------------------------------------- | ----------------: |
| Guest cart add/read/update/remove/clear        |            112 ms |
| Authenticated cart isolation + CSRF            |            206 ms |
| COD checkout/order creation                    |            182 ms |
| Duplicate checkout idempotency                 |            115 ms |
| 100 concurrent last-unit checkout attempts     |           2330 ms |
| Verified full-payment webhook                  |            136 ms |
| Concurrent duplicate webhook                   |            156 ms |
| Admin bounded order list + injection rejection |             52 ms |
| Admin fulfillment through shipping + one sale  |            205 ms |
| Atomic cancellation/release                    |             65 ms |
| Payment reconciliation sequence                |             86 ms |
| Concurrent reservation expiry workers          |             18 ms |

Commands:

```text
pnpm --filter @farta/api exec vitest run --config vitest.e2e.config.mts test/order-operations.e2e-spec.ts test/checkout.e2e-spec.ts test/payments.e2e-spec.ts --reporter=verbose
pnpm --filter @farta/api exec vitest run --config vitest.e2e.config.mts test/cart.e2e-spec.ts --reporter=verbose
```

## Query and resource bounds

- Admin list uses `limit <= 50`, `page <= 10000`, deterministic `createdAt/_id` sorting and separate count/list queries.
- Order detail issues a fixed, parallel set of payment, reservation, webhook-event and audit queries; it does not query once per line item.
- Webhook events and audit history are capped at 50 and 100 rows respectively.
- Reservation worker batch is typed and capped at 500; each candidate uses a short independent transaction.
- Search input is capped at 64 characters and regex metacharacters are escaped. Substring search can still become a collection scan at large scale.

## Remaining optimization work

- Measure p50/p95/p99 in staging with production-like order volume and indexes.
- Replace or constrain unanchored phone/order substring search if query plans degrade.
- Monitor worker backlog age, batch duration, conflicts and retry counts.
- Add projection or dedicated operational read models only after measured evidence; correctness remains the priority.
