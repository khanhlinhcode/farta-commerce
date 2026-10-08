# Phase 4 completion report

Date: 2026-10-08

## A. Architecture

Phase 4 is split into authoritative Cart, Idempotency, Reservations, Checkout, Orders and provider-neutral Payments. Phase 4D adds permissioned Admin order operations, a separately deployable reservation worker and a transactional notification outbox. MongoDB remains the commerce source of truth; no storefront/admin code talks directly to it.

## B. Cart and checkout

- Guest and authenticated carts, deterministic idempotent merge and owner-safe item mutations are implemented.
- Checkout preview and submit reprice, revalidate and ignore client money/identity authority.
- Stable idempotency keys make double submit one logical result; different payload reuse conflicts.

## C. Reservations and inventory

- Multi-item reservation shares the checkout MongoDB transaction.
- Conditional updates preserve `available = onHand - reserved` and append ledger rows.
- Shipping converts reserved units to `SALE`; eligible cancellation and expiry release once.
- Separate worker command polls bounded due `ACTIVE` reservations and is safe under concurrent execution.

## D. Orders and COD

- Immutable product, variant, price, image and shipping snapshots are stored behind non-sequential public order codes.
- Customer order ownership and guest code+phone verification are enforced server-side.
- COD selection remains `UNPAID`; delivered/completed staff collection records server-owned amount, actor, time, audit and notification intent.

## E. Online payment and SePay

- `PaymentProvider` isolates SePay parsing/verification from Order services.
- Server-driven VietQR instructions support full and configured deposit payments.
- Raw-body HMAC/timestamp verification, event idempotency, exact reference/account/amount checks and conflict persistence are implemented.
- Browser return/polling is informational; only verified provider processing mutates paid state.

## F. Admin operations

- Admin list/detail supports bounded search, filters, pagination, order/payment/reservation/webhook/audit views.
- Mutations require STAFF auth, granular permission, CSRF, legal state and a reason.
- Fulfillment, cancellation, manual refund reconciliation and COD collection use short atomic transactions and audit entries.
- Refund commands record an externally completed workflow; no fake or automatic provider refund is implemented.

## G. Notifications and observability

- Transactional idempotent outbox events exist for order created, payment received, confirmed, shipped and delivered.
- Events remain `PENDING`; no provider delivery is claimed.
- Worker failures are logged without reservation/customer payloads and retry on the next interval.

## H. Security and concurrency

- The final regression set covers Cart/Order BOLA, CSRF, RBAC, mass assignment, NoSQL-shaped input, price/quantity authority, guest enumeration, checkout replay, webhook spoof/replay, state transitions, inventory race and reservation expiry race.
- 100 simultaneous last-unit checkouts: exactly 1 success and 99 safe conflicts.
- Codex Security diff scan reviewed 26/26 inventoried Phase 4D source items with zero reportable findings; see `security-review.md` for snapshot limitations.

## I. Performance

Local scenario evidence is recorded in `performance-review.md`. The 100-way checkout test completed in 2330 ms and the Admin list scenario in 52 ms on the local test environment. These are not production SLAs or percentile measurements.

## J. Quality-gate evidence

The final gate table is populated only from commands run after the Phase 4D implementation:

| Gate                               | Result                                       |
| ---------------------------------- | -------------------------------------------- |
| frozen install                     | PASS; 9 workspaces, lockfile current         |
| format                             | PASS                                         |
| lint                               | PASS                                         |
| typecheck                          | PASS                                         |
| API unit                           | PASS; 12 files / 46 tests                    |
| Storefront unit/component          | PASS; 6 files / 18 tests                     |
| Admin unit/component               | PASS; 1 file / 2 tests                       |
| API E2E                            | PASS; 7 files / 64 tests                     |
| production builds                  | PASS; API, Admin and Storefront              |
| dependency audit                   | PASS; no known production vulnerabilities    |
| Python frozen sync / Ruff / Pytest | PASS; 2 tests                                |
| tracked high-signal secret scan    | PASS; 0 matching non-test/non-document files |

## K. Runtime smoke

MongoDB `7.0.41` replica set and Redis `8.2` responded to direct ping. Built API, Storefront, Admin and the AI service were started locally; the reservation worker ran as a separate built process.

- HTTP 200: API live/ready, public categories/products, Storefront home/cart/checkout/account orders/order lookup, Admin root, AI live/ready.
- Guest Cart returned an authoritative empty VND cart; unauthenticated Admin Orders returned HTTP 401.
- Reservation worker emitted visible start/stop lifecycle logs and exited 0 on SIGINT.
- Guest/authenticated Cart, merge, Checkout/COD, online mock payment/webhook, customer/guest order access, Admin transitions/reconciliation and worker concurrency were exercised by the 64-test MongoDB/Redis-backed E2E suite. They were not all reseeded through the separate live HTTP process.

`infra:up` was adjusted to wait for the long-lived MongoDB/Redis services and then run the replica-set initializer as an explicit one-shot container. This avoids Docker Compose treating a successful exited initializer as a failed long-lived service.

## L. Failure matrix

The deterministic outcomes and recovery paths are in `failure-matrix-final.md`. No database transaction spans external provider, email or media calls.

## M. External configuration and limitations

- Real SePay Test-mode credentials, public HTTPS webhook registration and provider-origin evidence.
- Production MongoDB replica set, Redis, TLS/proxy, secret store, monitoring and worker supervisor.
- Notification delivery provider/worker and retry/dead-letter policy.
- No production throughput, real-money or live email evidence is claimed.
- No BullMQ/new queue dependency was added without stakeholder approval.

## N. Final scope

Phase 4 ends here. AI Agent, RAG, AI Stylist, Vision, Livestream Copilot, Multi-Agent, Wishlist, Reviews, Coupons and Loyalty were not started.
