# ADR-017: Payment provider abstraction

Status: Accepted

## Decision

`PaymentsModule` persists provider-neutral payment records before any external interaction. `OrderService` depends on a `PaymentProvider` contract; provider adapters initiate a payment where supported, normalize instructions/results, verify authenticity and normalize events.

COD is the first complete method and never implies collection. SePay is a separate adapter. Provider calls occur after the order transaction and use the persisted payment/idempotency identity. Browser redirects and polling are informational; only a verified webhook or explicit server-to-provider verification can authoritatively change payment state.

Payment amounts are integer VND values calculated by the server. Deposit and full-payment policy are typed configuration. Production fails closed when an enabled method lacks required provider or business configuration.

## Consequences

- SePay fields do not leak into order-domain commands.
- Provider timeout leaves a queryable pending payment and a retry uses the same logical idempotency context.
- Automated tests use adapters/mocks or the official sandbox; mock-only evidence is not production-readiness evidence.
