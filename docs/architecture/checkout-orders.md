# Checkout and order architecture

## Checkout orchestration

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant M as MongoDB
  participant P as Payment provider
  C->>A: checkout command + Idempotency-Key
  A->>A: authenticate, CSRF, validate ownership
  A->>M: claim idempotency key
  A->>M: load cart, reprice, validate inventory
  A->>M: transaction: reserve + order snapshot
  A-->>C: order/payment action
  C->>P: provider interaction when required
  P->>A: signed webhook/event
  A->>M: idempotent payment + order transition
  A-->>C: authoritative order status
```

An idempotency record binds realm, actor/cart, route, key and canonical request hash. Reusing a key with a different request is rejected.

## Order snapshot

Each `OrderItem` stores `productId`, `variantId`, product name, SKU, color, size, unit price, quantity, discount/tax allocation where applicable, currency and image snapshot metadata. Shipping/customer contact snapshots are separated from mutable profiles and retained according to privacy policy.

## Fulfillment state machine

```mermaid
stateDiagram-v2
  [*] --> CREATED
  CREATED --> CONFIRMED
  CONFIRMED --> PACKING
  PACKING --> SHIPPING
  SHIPPING --> DELIVERED
  DELIVERED --> COMPLETED
  CREATED --> CANCELLED
  CONFIRMED --> CANCELLED
  CREATED --> PAYMENT_CONFLICT
  CONFIRMED --> PAYMENT_CONFLICT
```

Transition commands declare allowed source states, permission, side effects and audit event. Arbitrary `status` updates are forbidden.

## Payment state machine

`UNPAID → DEPOSIT_PAID → FULLY_PAID` where the selected method supports deposits.  
`DEPOSIT_PAID|FULLY_PAID → REFUND_PENDING → REFUNDED`.  
Any verified amount/reference mismatch enters `PAYMENT_CONFLICT` for review.

The frontend never declares payment success. Only verified provider callbacks or explicit server-side provider verification can transition payment state.

## Failure recovery

- Transaction failure creates no partial order/reservation.
- Provider timeout leaves a queryable pending state; retries use the same idempotency key.
- Webhooks validate signature, timestamp/replay rules, provider event ID, order reference, amount and currency before transition.
