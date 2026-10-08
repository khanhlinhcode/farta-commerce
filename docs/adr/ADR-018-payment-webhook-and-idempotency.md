# ADR-018: Payment webhook authenticity and idempotency

Status: Accepted

## Decision

SePay webhooks use the provider-documented HMAC-SHA256 mode. The signature input is `{X-SePay-Timestamp}.{raw_request_body}` and is verified with a dedicated secret using constant-time comparison. Parsed/re-serialized JSON is never used for verification. A bounded timestamp tolerance is enforced before processing.

The provider transaction `id` is the durable deduplication identity. A `payment_webhook_events` unique index on provider plus event ID makes concurrent replay one effective operation. An acknowledged replay must also match the accepted raw-body SHA-256 fingerprint using constant-time comparison; a reused event ID with different signed content is recorded as an anomaly and rejected. A verified event must match direction, configured account where available, payment reference, expected amount and VND currency/business context before state mutation.

Amount/reference/account mismatch, a payment outside its valid window, late payment after reservation expiry, and payment in an incompatible order/payment state enter explicit `PAYMENT_CONFLICT` reconciliation; they are never silently accepted or auto-refunded.

General mutation idempotency binds realm/owner context, operation, key and canonical request hash. Same key and hash return the same logical resource; same key with a different hash returns `409 IDEMPOTENCY_KEY_REUSED`.

## Provider evidence

Official SePay documentation accessed 2026-10-08:

- <https://developer.sepay.vn/en/sepay-webhooks/xac-thuc>
- <https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook>
- <https://developer.sepay.vn/en/sepay-webhooks/xu-ly-loi>
- <https://developer.sepay.vn/en/tien-ich-khac/test-mode>

The documentation provides Test mode, raw-body HMAC headers, timestamp signing, transaction ID/reference/amount fields and delivery retry behavior. The bank-webhook payload documents transfers in VND and does not carry an independent currency field; the adapter normalizes that contract to `VND`, while the internal payment currency is immutable and validated. Production account configuration, webhook registration and real credential validation remain external deployment evidence.
