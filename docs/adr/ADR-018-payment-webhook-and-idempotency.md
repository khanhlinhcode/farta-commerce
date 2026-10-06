# ADR-018: Payment webhook authenticity and idempotency

Status: Accepted

## Decision

SePay webhooks use the provider-documented HMAC-SHA256 mode. The signature input is `{X-SePay-Timestamp}.{raw_request_body}` and is verified with a dedicated secret using constant-time comparison. Parsed/re-serialized JSON is never used for verification. A bounded timestamp tolerance is enforced before processing.

The provider transaction `id` is the durable deduplication identity. A `payment_webhook_events` unique index on provider plus event ID makes concurrent replay one effective operation. A verified event must also match direction, configured account where available, payment reference, expected amount and VND currency/business context before state mutation.

Amount/reference mismatch, duplicate transaction mapped elsewhere, late payment after reservation expiry, cancelled/completed-order payment and unavailable inventory enter explicit `PAYMENT_CONFLICT` reconciliation; they are never silently accepted or auto-refunded.

General mutation idempotency binds realm/owner context, operation, key and canonical request hash. Same key and hash return the same logical resource; same key with a different hash returns `409 IDEMPOTENCY_KEY_REUSED`.

## Provider evidence

Official SePay documentation accessed 2026-10-06:

- <https://developer.sepay.vn/en/sepay-webhooks/xac-thuc>
- <https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook>
- <https://developer.sepay.vn/en/sepay-webhooks/test-mode/so-sanh-voi-live>
- <https://developer.sepay.vn/en/cong-thanh-toan/API/tong-quan>

The documentation provides Test mode/sandbox, raw-body HMAC headers, timestamp signing, transaction ID/reference/amount fields and delivery retry behavior. Production account configuration, bank account matching and real credential validation remain external deployment evidence.
