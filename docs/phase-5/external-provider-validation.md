# Phase 5C — External provider validation

Date: 2026-10-20

Status: **PARTIAL — local provider-security contracts pass; live provider
validation is blocked**

This report separates implementation and local integration evidence from
evidence produced by an external provider. It contains no credential value.

## Provider status matrix

| Boundary            | Source/local evidence                                                                                   | External staging evidence                                                                                         | Status       |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| Cloudinary delivery | Public catalog and hero media render from the configured Cloudinary cloud in the deployed browser suite | Existing staging assets returned successfully; no new upload/destructive lifecycle test was run in Phase 5C       | PARTIAL      |
| SePay bank webhook  | Raw-body HMAC, timestamp tolerance, replay, mismatch, ownership and conflict tests pass                 | No SePay Test-mode account/webhook delivery evidence is available                                                 | BLOCKED      |
| Google OAuth        | State/nonce/S256 PKCE transaction foundation and disabled-provider status exist                         | There is no concrete Google adapter or public start/callback route, and no development credentials are configured | BLOCKED      |
| Apple OAuth         | Provider-neutral transaction foundation exists                                                          | There is no concrete Apple adapter/public callback and no Apple development credentials are configured            | BLOCKED      |
| Transactional email | Transactional notification intents are persisted idempotently in the outbox                             | No delivery provider or retry/dead-letter worker is configured                                                    | BLOCKED      |
| Domain forwarding   | Namecheap MX/SPF and active forwarding use are confirmed                                                | Alias inventory and tested replacement route are not yet available                                                | BLOCKED      |
| Monitoring/alerts   | Structured redacted logs, request IDs and health endpoints exist                                        | No alert integration/delivery evidence is configured                                                              | BLOCKED      |
| Gemini/Groq         | Deterministic Product Advisor provider-off path was previously validated                                | Live inference remains intentionally disabled                                                                     | OUT OF SCOPE |

## SePay documentation checkpoint

Official sources accessed 2026-10-20:

- <https://developer.sepay.vn/en/sepay-webhooks/xac-thuc>
- <https://developer.sepay.vn/en/sepay-webhooks/test-mode/bat-dau-nhanh>
- <https://developer.sepay.vn/en/sepay-webhooks/xu-ly-loi>
- <https://docs.sepay.vn/tich-hop-webhooks.html>

The official authentication contract uses `X-SePay-Timestamp` and
`X-SePay-Signature: sha256=<hex>`, with HMAC-SHA256 over
`{timestamp}.{raw_request_body}`. The timestamp is part of replay protection;
the provider documents retries and Test mode separately from Live mode.

The current `SePayPaymentProvider` follows that raw-body contract, compares the
signature in constant time, enforces a bounded timestamp tolerance, and keeps
provider parsing outside the Order service. The browser return and payment
status polling paths are informational only.

### Local integration evidence

Command:

```bash
pnpm --filter @farta/api exec vitest run \
  --config vitest.e2e.config.mts test/payments.e2e-spec.ts
```

Result: **1 file / 16 tests passed in 6.41 seconds**.

The covered cases include valid locally signed delivery, invalid/stale
signature, concurrent duplicate event, changed-payload replay, amount mismatch,
undocumented currency input, unknown reference, deposit followed by exact final
payment, browser return not marking payment paid, bounded polling, late payment
after reservation expiry and guest payment ownership.

This is local integration evidence using a test-only key. It is not evidence
that SePay Test mode delivered a webhook. `SEPAY_ENABLED` remains effectively
disabled on staging until its complete secret-managed Test-mode configuration
is supplied. No production money was used.

## Google and Apple OAuth

The repository has provider configuration schemas, an adapter contract,
external-identity persistence and one-time Redis state/nonce/PKCE transactions.
It deliberately has no Google/Apple success route because concrete provider
token exchange and cryptographic identity-token verification have not been
implemented.

Adding credentials alone cannot make these flows valid. The required next
change is a separately approved provider adapter implementation, including an
exact dependency/version checkpoint if a new production package is needed.
Until then, the Storefront buttons remain honestly unavailable and arbitrary
OAuth identities cannot enter the Staff/Admin realm.

## Transactional email

Order and payment events create retry-safe notification intents without making
commerce transactions depend on email delivery. No SMTP/API provider, delivery
worker or dead-letter policy is configured. Existing events therefore remain
`PENDING`; no email-delivery claim is made.

This application notification boundary is separate from the domain's existing
Namecheap Email Forwarding. The stakeholder confirmed that forwarding is in
active use. That service depends on Namecheap DNS according to Namecheap's
current documentation, so the Cloudflare nameserver cutover is blocked until
the aliases are inventoried and migrated to a verified replacement such as
Cloudflare Email Routing or another approved mail provider. Destination mailbox
values must not be committed or included in reports.

## Monitoring

API and worker logs use structured request/event identifiers and redact
authorization headers, cookies, JWT/refresh/reset/OAuth/provider secrets,
database/Redis URIs and sensitive payload fields. Public health endpoints and
Northflank/Cloudflare runtime status are available.

There is no configured alert sink for readiness failure, reservation-worker
failure, webhook authentication spikes, `PAYMENT_CONFLICT`, notification retry
exhaustion or provider errors. No Sentry or other production dependency was
added without approval, and no alert-delivery evidence is claimed.

## Required external configuration

1. SePay Test-mode account, Test-mode bank/webhook configuration and secret
   entered directly in the Northflank secret manager.
2. Google OAuth development application plus a reviewed concrete adapter and
   exact callback route.
3. Apple Service ID/key/team configuration only if Apple is required for this
   milestone, after the adapter exists.
4. Selected transactional email provider and approved delivery worker design.
5. Selected monitoring/alert provider, recipients, retention and PII policy.

No provider may move from `BLOCKED` to `PASS` based only on local mocks or
configuration presence.
