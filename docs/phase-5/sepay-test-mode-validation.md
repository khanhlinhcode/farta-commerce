# Phase 5E — SePay Test-mode validation

Date: 2026-10-21

External-provider status: **BLOCKED**. Local integration/security status:
**PASS**.

No production money was used, no webhook was fabricated as provider evidence,
and no SePay credential was printed or committed.

## Official specification reviewed

Sources accessed 2026-10-21:

- [SePay webhook authentication](https://developer.sepay.vn/en/sepay-webhooks/xac-thuc)
- [SePay Test Mode quick start](https://developer.sepay.vn/en/sepay-webhooks/test-mode/bat-dau-nhanh)
- [SePay Test Mode versus Live](https://developer.sepay.vn/en/sepay-webhooks/test-mode/so-sanh-voi-live)

The official authentication page defines `X-SePay-Timestamp` and
`X-SePay-Signature`, with `sha256=<hex HMAC-SHA256>` over
`{timestamp}.{raw_body}`. Its example applies a five-minute timestamp window.
The Test-mode documentation describes an isolated simulation environment,
requires an HTTP 200/201 success response with `{"success":true}`, and states
that the payload/retry shape mirrors Live. The comparison page documents retry
attempts using the provider's stated schedule. These statements are provider
documentation, not observations of this FARTA deployment.

## Source implementation and local evidence

`SePayPaymentProvider` verifies the documented timestamp/signature construction
using the raw request body and a constant-time signature comparison. Payment
records exist before initiation; order/payment states remain separate; provider
event IDs and transaction IDs have uniqueness boundaries.

`pnpm test:e2e` passed 7 files / 65 tests. The payment suite covers:

- valid signed webhook and deposit/full-payment transitions;
- invalid signature and stale timestamp rejection;
- replay and concurrent duplicate delivery with one effective transition;
- amount/reference/account mismatch and unknown references;
- provider transaction uniqueness;
- browser return that cannot mark a payment paid;
- late payment after reservation expiry and reconciliation/conflict behavior;
- safe ownership and post-refund transition constraints.

These are local integration tests with controlled test credentials. They do not
prove delivery from SePay infrastructure.

## Staging checkpoint

A value-free inspection of the Northflank API runtime found SePay disabled and
the required configuration incomplete. Consequently, the following required
external evidence does not exist:

- a Test-mode staging order/payment initiation;
- provider-issued instructions/reference;
- a real SePay Test-mode signed webhook and delivery log;
- a provider-side replay and amount-mismatch exercise;
- provider audit/reconciliation evidence.

The browser payment waiting/confirmed/conflict lane was not claimed because no
official Test-mode transaction was available.

## Unblock requirements

1. Provision a SePay Test-mode account and webhook endpoint configuration.
2. Add only the documented staging values to the Northflank secret manager.
3. Confirm the configured account/reference/currency rules with current SePay
   documentation.
4. Execute the full official Test-mode matrix and retain redacted provider
   delivery evidence.
5. Keep Live credentials and real money out of this validation.
