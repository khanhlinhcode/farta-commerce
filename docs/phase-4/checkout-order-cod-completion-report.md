# Phase 4B Checkout, Order and COD completion report

Date: 2026-10-07

## A. Architecture

Added bounded `IdempotencyModule`, `ReservationsModule`, `CheckoutModule`, `OrdersModule` and provider-neutral `PaymentsModule`. Checkout uses one short MongoDB transaction and no external network call. Phase 2 `InventoryService` now exposes session-aware batch reserve/release primitives while retaining the standalone compatibility method.

## B. Idempotency

Records bind realm, owner key/digest, operation, hashed idempotency key and canonical request hash. A unique index arbitrates concurrent claims. Completed retries return the same Order; different content with the same key returns conflict. Raw keys are not selected by default and records have a 24-hour cleanup TTL.

## C. Reservation and inventory

Reservations implement `ACTIVE`, `CONFIRMED`, `RELEASED`, `EXPIRED`, `CANCELLED`. Inventory updates are conditional and append a `RESERVE` or `RELEASE` ledger entry in the caller's transaction. Expiry and explicit release select eligible states, mutate inventory/ledger atomically and are retry-safe.

## D. Checkout and COD

`POST /checkout/preview` returns current item prices, conflicts, shipping, total, COD availability and a signed quote without reserving. `POST /checkout` normalizes Vietnamese phone input, rejects unknown authority fields, validates the quote, reserves inventory, snapshots the order and creates an `UNPAID` COD payment with `codAmount`. COD selection never records collection.

## E. Order and access

Order codes use date plus cryptographically random non-sequential characters. Product, variant, media, money, recipient and address data are snapshots. Customer list/detail queries include authenticated ownership. A guest can read through the original guest credential or look up a guest-created order using code plus keyed-digest phone verification under a Redis rate limit. The public lookup response omits shipping PII, database IDs, SKU and provider payment metadata; customer-owned orders are ineligible for this route.

## F. Storefront

Implemented `/checkout`, `/order-confirmation/[code]`, `/order-lookup`, `/account/orders` and `/account/orders/[code]`. The checkout uses React Hook Form, Zod, real preview data, a stable idempotency key for retry, explicit stock/price conflict copy and COD-only language. No payment success is simulated.

## G. Security evidence

The Phase 4B E2E suite covers Cart/Order ownership, CSRF, unknown fields/mass assignment, wrong guest verification, lookup throttling, client authority rejection, idempotency replay, stale quotes and safe 500 envelopes. The 100-way concurrency scenario runs against the local MongoDB replica set. The installed Strix executable did not return usable CLI output, and the Codex Security connector required by its scan workflow was unavailable in the current tool surface. These are explicit application tests, not a third-party pentest claim.

## H. Test evidence

Evidence recorded before the final commit:

- `pnpm typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm test`: API 12 files / 45 tests, Storefront 5 files / 11 tests, Admin 1 file / 1 test, all pass.
- `pnpm test:e2e`: 5 files / 42 tests pass.
- concurrency: stock `1`, 100 checkout submissions produced exactly 1 HTTP 201 and 99 HTTP 409; final inventory `onHand=1`, `reserved=1`, one confirmed reservation.
- double click: two concurrent HTTP 201 responses returned the same Order ID and one persisted Order.
- rollback: injected Order creation failure returned a safe HTTP 500 and left reserved inventory, reservation and inventory ledger counts unchanged.

## I. Runtime smoke evidence

Local runtime used MongoDB `7.0.41` as a replica set, Redis `8.2`, the production API build and a production Storefront build configured with `API_INTERNAL_URL=http://127.0.0.1:4000`.

- API liveness/readiness: HTTP 200.
- Storefront `/checkout` and `/order-lookup`: HTTP 200.
- guest Cart -> preview -> COD checkout through the Storefront `/api` proxy: HTTP 201.
- same idempotency key and identical body: HTTP 201 with the same Order ID.
- guest credential detail and code + phone lookup: HTTP 200/201; wrong phone: HTTP 404.
- persisted result: one Order, one Payment, one confirmed Reservation, one `RESERVE` ledger entry; inventory remained `onHand=2`, `reserved=1`.
- resulting Order state: `CREATED`; Payment state: `UNPAID`; authoritative total: `329000` VND.

The Next.js rewrite is generated at build time, so `API_INTERNAL_URL` must be present during the Storefront production build. Passing it only to `next start` does not retrofit a missing rewrite.

## J. Configuration

Required new variables are documented in `.env.example`: reservation TTL, flat shipping fee, optional free-shipping threshold, independent order lookup/quote secret and Checkout/lookup rate limits. Values remain stakeholder/deployment configuration and are not claimed as approved production pricing.

## K. Known limitations and Phase 4C boundary

- No SePay adapter, provider initiation, payment webhook or online payment UI exists yet.
- No Admin order transition UI or background scheduler exists yet; reservation expiry has an idempotent service primitive for the Phase 4D scheduler.
- No email provider is configured.
- Automated screenshot capture remains unavailable because the local macOS process lacks Screen Recording permission; no visual screenshot claim is made.
- Production deployment, real traffic and real money were not exercised.
