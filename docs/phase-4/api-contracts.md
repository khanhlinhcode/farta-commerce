# Phase 4 API contracts

All routes are under `/api/v1`, use the existing safe error envelope and reject unknown DTO fields. Cookie-authenticated mutations require the existing CSRF header; guest cart/checkout mutations require an allowed `Origin`. Rate-limit responses use HTTP 429.

## Cart

| Method | Route                 | Input                   | Result                                         |
| ------ | --------------------- | ----------------------- | ---------------------------------------------- |
| GET    | `/cart`               | none                    | authoritative cart read model                  |
| POST   | `/cart/items`         | `variantId`, `quantity` | updated cart                                   |
| PATCH  | `/cart/items/:itemId` | `quantity`              | updated cart                                   |
| DELETE | `/cart/items/:itemId` | none                    | updated cart                                   |
| DELETE | `/cart`               | none                    | empty cart; idempotent                         |
| POST   | `/cart/merge`         | no owner IDs            | authenticated target plus structured conflicts |

The cart response contains display-safe product/variant/media, integer price/subtotal/total, semantic availability and conflict codes. It excludes owner digests, exact stock and internal actor fields.

## Checkout and orders

| Method | Route                       | Auth/verification                       | Notes                                                  |
| ------ | --------------------------- | --------------------------------------- | ------------------------------------------------------ |
| POST   | `/checkout/preview`         | current guest/customer owner            | authoritative reprice/availability; no reservation     |
| POST   | `/checkout`                 | current owner + `Idempotency-Key`       | atomic reservation/order/payment creation              |
| GET    | `/orders`                   | customer session                        | own orders only, bounded pagination                    |
| GET    | `/orders/:orderCode`        | customer session                        | own order only                                         |
| POST   | `/orders/lookup`            | code + normalized phone                 | restricted guest result, enumeration-safe/rate-limited |
| POST   | `/orders/:orderCode/cancel` | owner session or verified guest context | Phase 4D command; not exposed in Phase 4B              |

Checkout accepts recipient/shipping/payment fields only. `customerId`, prices, totals, order/payment status, inventory deltas and reservation ownership are rejected.

## Payments

| Method | Route                               | Notes                                                           |
| ------ | ----------------------------------- | --------------------------------------------------------------- |
| POST   | `/payments/:paymentId/initiate`     | Phase 4C                                                        |
| GET    | `/payments/:paymentId/status`       | Phase 4C                                                        |
| POST   | `/payments/providers/sepay/webhook` | Phase 4C; raw body HMAC/timestamp verification; no browser CSRF |

The SePay endpoint returns only the provider-required success response after the event has been durably accepted. Browser success/error returns never transition payment state.

## Admin order operations

Routes under `/admin/orders` require staff-realm authentication, granular permissions, CSRF, state policy and audit. List filters are explicit and bounded. Transition endpoints name commands (`confirm`, `pack`, `ship`, `deliver`, `complete`, `cancel`, `reconcile`) rather than accepting arbitrary status.

## Domain errors

`CART_NOT_FOUND`, `CART_ITEM_LIMIT`, `CHECKOUT_QUOTE_CHANGED`, `CHECKOUT_CART_CONFLICT`, `CHECKOUT_STOCK_CONFLICT`, `INSUFFICIENT_STOCK`, `INVALID_IDEMPOTENCY_KEY`, `IDEMPOTENCY_KEY_REUSED`, `CHECKOUT_IN_PROGRESS`, `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `INVALID_PAYMENT_TRANSITION`. Payment-provider and webhook errors begin in Phase 4C.
