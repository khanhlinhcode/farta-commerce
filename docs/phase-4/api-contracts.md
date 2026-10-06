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
| POST   | `/orders/:orderCode/cancel` | owner session or verified guest context | only allowed states; bounded reason                    |

Checkout accepts recipient/shipping/payment fields only. `customerId`, prices, totals, order/payment status, inventory deltas and reservation ownership are rejected.

## Payments

| Method | Route                               | Notes                                                          |
| ------ | ----------------------------------- | -------------------------------------------------------------- |
| POST   | `/payments/:paymentId/initiate`     | authenticated/verified order owner; stable idempotency context |
| GET    | `/payments/:paymentId/status`       | bounded polling; ownership required                            |
| POST   | `/payments/providers/sepay/webhook` | raw body HMAC/timestamp verification; no browser CSRF          |

The SePay endpoint returns only the provider-required success response after the event has been durably accepted. Browser success/error returns never transition payment state.

## Admin order operations

Routes under `/admin/orders` require staff-realm authentication, granular permissions, CSRF, state policy and audit. List filters are explicit and bounded. Transition endpoints name commands (`confirm`, `pack`, `ship`, `deliver`, `complete`, `cancel`, `reconcile`) rather than accepting arbitrary status.

## Domain errors

`CART_NOT_FOUND`, `CART_CONFLICT`, `CART_ITEM_LIMIT`, `CHECKOUT_PRICE_CHANGED`, `INSUFFICIENT_STOCK`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `PAYMENT_NOT_FOUND`, `INVALID_PAYMENT_TRANSITION`, `PAYMENT_CONFLICT`, `WEBHOOK_AUTHENTICATION_FAILED`.
