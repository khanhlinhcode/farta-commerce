# Phase 4 transactional architecture

Date: 2026-10-06

## Boundaries

```mermaid
flowchart LR
  Browser[Storefront or Admin] --> API[NestJS API]
  API --> Cart[CartModule]
  API --> Checkout[CheckoutModule]
  Checkout --> Idem[IdempotencyModule]
  Checkout --> Inventory[InventoryService batch API]
  Checkout --> Reserve[ReservationsModule]
  Checkout --> Orders[OrdersModule]
  Checkout --> Payments[PaymentsModule]
  Cart --> Mongo[(MongoDB replica set)]
  Idem --> Mongo
  Inventory --> Mongo
  Reserve --> Mongo
  Orders --> Mongo
  Payments --> Mongo
  Payments --> Provider[PaymentProvider]
  Provider --> QR[VietQR instruction URL]
  SePay[SePay signed bank webhook] --> API
  API --> Redis[(Redis rate limits)]
```

The NestJS API remains authoritative. Storefront and Admin never connect to MongoDB, Redis or SePay directly. Provider calls, email and Cloudinary work are outside database transactions.

## Collections and indexes

| Collection               | Purpose                              | Required indexes                                                                                                                                                                                |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `carts`                  | server-owned guest/customer items    | unique partial active `{ownerType, customerId, channel, currency}` for customer; unique partial active `{ownerType, guestCredentialDigest, channel, currency}` for guest; `{status, expiresAt}` |
| `inventory_reservations` | stock allocation lifecycle           | unique `{idempotencyIdentity, variantId}`; `{status, expiresAt}`; `{orderId, status}`; `{variantId, status}`                                                                                    |
| `idempotency_records`    | replay binding/result                | unique `{realm, ownerKey, operation, key}`; TTL `{expiresAt}` after safe retention                                                                                                              |
| `orders`                 | immutable checkout snapshots/state   | unique `orderCode`; unique `checkoutIdempotencyRecordId`; `{customerId, createdAt}`; `{status, createdAt}`; `{recipientPhoneHash, createdAt}`                                                   |
| `payments`               | provider-neutral money state         | unique `{orderId}`; unique partial `{provider, providerTransactionId}`; unique partial `{provider, providerReference}`; `{status, updatedAt}`                                                   |
| `payment_webhook_events` | authenticated delivery deduplication | unique `{provider, eventId}`; `{status, createdAt}`; no raw body stored                                                                                                                         |

Money is integer VND. Exact internal inventory quantity is never exposed publicly.

## Transaction boundaries

### Cart mutation

One cart document update uses an optimistic `version` predicate. Merge uses one short MongoDB transaction to update target, mark source `MERGED`, and record the merge identity.

### Checkout submission

1. Claim/bind idempotency before the commerce transaction; a concurrent claimant observes `IN_PROGRESS` or the completed result.
2. In one short MongoDB transaction: load/own-check cart; revalidate catalog and prices; conditionally reserve every variant with one session; append ledger; create reservation rows; create order snapshots; create provider-neutral payment; confirm allocations; mark cart converted; complete idempotency with resource ID.
3. Commit before any provider/network action.

A transaction abort leaves no order, reservation, ledger or inventory delta. Retry uses the same idempotency record.

### Webhook/reconciliation

Parse through the strict DTO, verify HMAC over the original raw bytes and timestamp, then normalize into domain input. In a short transaction, claim provider event ID, bind replay to the accepted payload fingerprint, compare account/reference/amount/state, transition payment/order/reservation as allowed and mark the event processed. No raw body, free-form transfer content or secret is persisted. Phase 4D adds the Admin reconciliation/audit surface.

### Expiry/cancellation

Workers or commands atomically claim eligible current states, release inventory and append `RELEASE` ledger entries in the same transaction. Retrying a completed state is a no-op with the same result.

## Implemented payment boundary

SePay initiation is deterministic instruction generation, not a remote provider call. Online checkout keeps reservations `ACTIVE`; the first verified receipt confirms the full reservation set. Deposit receipt extends the remaining-payment window without releasing confirmed inventory. A late or mismatched event enters explicit conflict state and never silently allocates stock or marks an order paid.
