# Checkout and Orders API

All routes use `/api/v1`, the standard safe error envelope and strict DTO allowlists. Money is integer VND. Browser requests use credentialed cookies.

## Checkout preview

`POST /checkout/preview`

- Ownership: the authenticated customer cart or the HMAC-bound guest cart cookie.
- CSRF: authenticated sessions send `x-csrf-token`; guests must send an allowed `Origin`/`Referer`.
- Input: `{}` only.
- Side effects: none. Preview does not reserve stock.
- Response: authoritative item lines, conflict list, shipping fee, total, allowed payment methods and an HMAC quote token.

The quote token binds cart identity/version, variant quantities, current prices, shipping and conflicts. It is not a payment credential.

## Submit checkout

`POST /checkout`

Required header: `Idempotency-Key` containing 16–120 URL-safe characters.

Allowed body:

```json
{
  "recipientName": "Linh To",
  "phone": "0912345678",
  "addressLine": "12 Nguyen Hue",
  "provinceCity": "Ho Chi Minh City",
  "district": "District 1",
  "ward": "Ben Nghe",
  "shippingMethod": "STANDARD",
  "paymentMethod": "COD",
  "notes": "Call before delivery",
  "quoteToken": "server-issued HMAC"
}
```

The server normalizes the Vietnamese mobile phone to `+84...`, reloads the cart in the MongoDB transaction, reprices all lines, checks the quote, conditionally reserves every variant, writes ledger/reservation/order/payment records and converts the cart. COD allocations are confirmed in the transaction; online allocations remain active until the first verified receipt. There is no network call inside this transaction.

Same owner + operation + key + canonical request returns the same order. Reusing the key for another request returns `IDEMPOTENCY_KEY_REUSED`. Client `customerId`, price, subtotal, total, inventory, order status or payment status fields are rejected.

`COD` creates an `UNPAID` provider-neutral payment with `codAmount`; selecting COD never records collection. When SePay is explicitly configured, preview may also advertise `FULL` and a configured `DEPOSIT`; the server signs those amounts into the quote and ignores client totals.

## Customer orders

- `GET /orders?limit=1..50`: authenticated customer’s own orders.
- `GET /orders/:orderCode`: authenticated owner, or the same guest credential that created the order.

Object ownership is part of the database query. A valid code owned by another customer returns the same `ORDER_NOT_FOUND` envelope.

## Guest lookup

`POST /orders/lookup`

Body: `orderCode` plus recipient phone. The phone is normalized and compared through a keyed digest. The route has the dedicated `ORDER_LOOKUP` Redis rate policy and returns an enumeration-safe `ORDER_NOT_FOUND` response for either a wrong code or wrong phone.

Only guest orders (`customerId = null`) are eligible for this public verification path. The response intentionally excludes recipient/address/phone/notes, database identifiers, SKU and provider payment metadata. Authenticated customer orders remain available only through the owning customer session.

## Online payments

- `POST /payments/:orderCode/initiate`: returns existing SePay/VietQR instructions for the owning customer or original guest credential; it does not mark payment successful.
- `GET /payments/:orderCode/status`: returns the authoritative payment status for bounded storefront polling.
- `POST /webhooks/sepay`: validates the official raw-body HMAC and timestamp, then processes the provider event idempotently.

Deposit receipt changes `UNPAID → DEPOSIT_PAID`; a second exact remaining receipt changes it to `FULLY_PAID`. Full payment changes `UNPAID → FULLY_PAID`. Any amount/account/window/state mismatch enters reconciliation rather than being accepted.

## Admin order operations

All routes below require the `STAFF` realm. Every mutation also requires session-bound CSRF and the stated permission.

- `GET /admin/orders`: `order.read`; bounded `q`, order/payment status, method, date, page, limit and stable sort filters.
- `GET /admin/orders/:orderCode`: `order.read`; safe order, payment, reservation, webhook-event and audit projections.
- `PATCH /admin/orders/:orderCode/status`: `order.update`; body contains only `status` and a required reason. The domain state machine decides whether the transition is legal.
- `POST /admin/orders/:orderCode/cancel`: `order.cancel`; releases eligible reservations and writes the audit entry atomically.
- `POST /admin/orders/:orderCode/payment-reconciliation`: `order.update`; supports manual `START_REFUND` and `CONFIRM_REFUNDED`. This records external work; it does not call or simulate a provider refund.
- `POST /admin/orders/:orderCode/cod-collected`: `order.update`; accepts only a reason. The server uses the persisted COD amount and allows collection only for a delivered/completed COD order.

Online orders can be confirmed only by verified payment processing. `SHIPPING` commits reserved stock as a `SALE` ledger entry. Paid conflicts must be reconciled before cancellation.

## Errors

- `INVALID_IDEMPOTENCY_KEY`
- `IDEMPOTENCY_KEY_REUSED`
- `CHECKOUT_IN_PROGRESS`
- `CHECKOUT_QUOTE_CHANGED`
- `CHECKOUT_CART_CONFLICT`
- `CHECKOUT_STOCK_CONFLICT`
- `INSUFFICIENT_STOCK`
- `INVALID_PHONE`
- `ORDER_NOT_FOUND`
- `PAYMENT_NOT_FOUND`
- `PAYMENT_EXPIRED`
- `PAYMENT_NOT_INITIABLE`
- `PAYMENT_PROVIDER_UNAVAILABLE`
- `SEPAY_WEBHOOK_UNAUTHORIZED`
- `SEPAY_WEBHOOK_EXPIRED`
- `INVALID_ORDER_TRANSITION`
- `ONLINE_PAYMENT_REQUIRES_WEBHOOK`
- `ORDER_PAYMENT_NOT_READY`
- `ORDER_CANCELLATION_PAYMENT_CONFLICT`
- `PAYMENT_REFUND_NOT_ALLOWED`
- `REFUND_REFERENCE_REQUIRED`
- `COD_COLLECTION_ORDER_STATE_INVALID`
- `COD_COLLECTION_NOT_ALLOWED`
