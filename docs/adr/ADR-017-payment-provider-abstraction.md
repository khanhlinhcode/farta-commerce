# ADR-017: Payment provider abstraction

Status: Accepted

## Decision

`PaymentsModule` persists provider-neutral payment records inside the checkout transaction and before any provider interaction. `CheckoutService` depends only on `PaymentsService`; the `PaymentProvider` contract owns provider-specific instruction generation and webhook normalization/authentication.

COD never implies collection. The SePay adapter uses direct bank-transfer instructions: the server creates a unique payment reference and an official VietQR delivery URL from configured merchant bank data. This flow has no outbound provider API call during initiation. Browser redirects and polling are informational; only a verified webhook can authoritatively change payment state.

Payment amounts are integer VND values calculated by the server. Deposit and full-payment policy are typed configuration. Production fails closed when an enabled method lacks required provider or business configuration.

## Consequences

- SePay fields do not leak into order-domain commands.
- Repeating initiation returns instructions for the existing payment; it does not create another payment attempt.
- Automated tests use adapters/mocks or the official sandbox; mock-only evidence is not production-readiness evidence.

## Provider evidence

Official SePay documentation accessed 2026-10-08:

- <https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code>
- <https://developer.sepay.vn/en/tien-ich-khac/test-mode>
- <https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook>

This ADR selects bank webhooks plus VietQR, not the separate SePay Payment Gateway/IPN product. A future gateway adapter requires a separate decision and provider contract.
