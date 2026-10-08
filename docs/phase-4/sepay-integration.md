# SePay integration

Date: 2026-10-08

## Selected product boundary

FARTA Phase 4C uses SePay bank webhooks with an official VietQR delivery URL. It does not use the separate SePay Payment Gateway/IPN API.

1. Checkout persists one provider-neutral `Payment` before any instruction is shown.
2. The API derives a unique uppercase transfer reference from the public order code.
3. `POST /api/v1/payments/:orderCode/initiate` returns configured bank details, exact server-calculated amount, reference, expiry and VietQR URL.
4. SePay sends a bank webhook to `POST /api/v1/webhooks/sepay`.
5. Only a verified webhook can move payment/order/reservation state.

Initiation has no outbound provider API call, so there is no provider-timeout branch in this selected flow. An interrupted browser request is retried against the same persisted payment and reference.

## Official provider contract

Official documentation accessed 2026-10-08:

- Authentication: <https://developer.sepay.vn/en/sepay-webhooks/xac-thuc>
- Webhook payload and response: <https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook>
- Delivery/retry behavior: <https://developer.sepay.vn/en/sepay-webhooks/xu-ly-loi>
- Test mode: <https://developer.sepay.vn/en/tien-ich-khac/test-mode>
- VietQR URL: <https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code>

Authentication uses:

- `X-SePay-Timestamp`;
- `X-SePay-Signature: sha256=<hex>`;
- signature input `{timestamp}.{raw_request_body}`;
- HMAC-SHA256 with the dedicated webhook secret;
- a configured tolerance of 30–900 seconds, default 300;
- constant-time signature comparison.

FARTA preserves the exact raw request bytes through Nest's `rawBody` support. Parsed/re-serialized JSON is never used for HMAC verification.

The provider event `id` is the deduplication identity. A unique `{provider,eventId}` index makes concurrent replay one effective transition. A replay is acknowledged only when its raw-body SHA-256 fingerprint matches the accepted event in constant time; a changed signed payload is recorded and rejected. Success returns HTTP 200 with exactly `{ "success": true }`.

## Amount and state rules

- All authoritative values are safe integer VND.
- Full payment accepts exactly `orderTotal` from `UNPAID`.
- Deposit accepts exactly the configured fixed amount or `ceil(total * basisPoints / 10000)`.
- The remaining receipt accepts exactly `orderTotal - receivedAmount`.
- COD selection never marks money collected.
- Initiation, redirects and polling never mark payment successful.
- Account, amount, window, reservation or state mismatch creates `CONFLICT` / `PAYMENT_CONFLICT`; there is no automatic refund.

The documented bank-webhook payload does not include a separate currency property. SePay documents `transferAmount` in VND. The adapter therefore normalizes the provider event to `VND`, while the persisted payment currency remains immutable and is compared before mutation.

## Configuration

Keep all values in the deployment secret/configuration store, never client-side variables:

```dotenv
PAYMENT_INITIATE_LIMIT=20
PAYMENT_INITIATE_GLOBAL_LIMIT=100
PAYMENT_INITIATE_WINDOW_SECONDS=300
PAYMENT_STATUS_LIMIT=120
PAYMENT_STATUS_GLOBAL_LIMIT=600
PAYMENT_STATUS_WINDOW_SECONDS=300
TRUST_PROXY_HOPS=0
SEPAY_ENABLED=false
SEPAY_BANK_NAME=
SEPAY_ACCOUNT_NUMBER=
SEPAY_ACCOUNT_HOLDER=
SEPAY_WEBHOOK_SECRET=
SEPAY_WEBHOOK_TOLERANCE_SECONDS=300
SEPAY_PAYMENT_CODE_PREFIX=FAR
SEPAY_DEPOSIT_MODE=DISABLED
SEPAY_DEPOSIT_FIXED_VND=
SEPAY_DEPOSIT_BASIS_POINTS=
```

`TRUST_PROXY_HOPS` is the exact trusted reverse-proxy hop count used to derive
the client IP for source-wide throttles. Keep it at `0` for direct traffic and
configure the deployment topology explicitly; arbitrary forwarded addresses
are never trusted.

Enabling SePay without bank data or a minimum 32-character webhook secret fails startup. Deposit configuration is mutually exclusive: `FIXED` uses `SEPAY_DEPOSIT_FIXED_VND`; `PERCENTAGE` uses basis points `1..9999`; `DISABLED` advertises full payment only.

## Deployment checklist

1. Configure the merchant bank account and HMAC webhook in SePay Test mode.
2. Put the secret only in the API secret store and register the public HTTPS webhook URL.
3. Confirm the configured account number matches webhook delivery.
4. Execute Test-mode full, deposit and duplicate-delivery scenarios.
5. Inspect reconciliation events and order/payment state before enabling live traffic.
6. Rotate the webhook secret and repeat signature/replay tests when moving environments.

No real SePay credential, production bank account or customer payment belongs in Git or automated tests.
