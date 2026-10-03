# ADR-008: Checkout idempotency

Status: Accepted

Checkout/order creation requires an idempotency key bound to actor/cart/route and canonical request hash. Price/inventory are recomputed server-side; reservation and order snapshot commit transactionally. Order/payment changes use explicit state-machine commands.
