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

The server normalizes the Vietnamese mobile phone to `+84...`, reloads the cart in the MongoDB transaction, reprices all lines, checks the quote, conditionally reserves every variant, writes ledger/reservation/order/payment records, confirms the reservation set and converts the cart. There is no network call inside this transaction.

Same owner + operation + key + canonical request returns the same order. Reusing the key for another request returns `IDEMPOTENCY_KEY_REUSED`. Client `customerId`, price, subtotal, total, inventory, order status or payment status fields are rejected.

Phase 4B supports COD only. COD creates an `UNPAID` provider-neutral payment with `codAmount`; selecting COD never records collection.

## Customer orders

- `GET /orders?limit=1..50`: authenticated customer’s own orders.
- `GET /orders/:orderCode`: authenticated owner, or the same guest credential that created the order.

Object ownership is part of the database query. A valid code owned by another customer returns the same `ORDER_NOT_FOUND` envelope.

## Guest lookup

`POST /orders/lookup`

Body: `orderCode` plus recipient phone. The phone is normalized and compared through a keyed digest. The route has the dedicated `ORDER_LOOKUP` Redis rate policy and returns an enumeration-safe `ORDER_NOT_FOUND` response for either a wrong code or wrong phone.

Only guest orders (`customerId = null`) are eligible for this public verification path. The response intentionally excludes recipient/address/phone/notes, database identifiers, SKU and provider payment metadata. Authenticated customer orders remain available only through the owning customer session.

## Phase 4B errors

- `INVALID_IDEMPOTENCY_KEY`
- `IDEMPOTENCY_KEY_REUSED`
- `CHECKOUT_IN_PROGRESS`
- `CHECKOUT_QUOTE_CHANGED`
- `CHECKOUT_CART_CONFLICT`
- `CHECKOUT_STOCK_CONFLICT`
- `INSUFFICIENT_STOCK`
- `INVALID_PHONE`
- `ORDER_NOT_FOUND`

SePay initiation, online-payment polling and webhooks are intentionally absent until Phase 4C.
