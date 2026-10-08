# Phase 4C payment security review

Date: 2026-10-08

## Result

No unresolved Critical/High finding was identified in the implemented Phase 4C code and automated test scope. This is not a production-readiness claim: real SePay Test-mode credentials, provider delivery and deployment-edge behavior were not validated.

## Control review

| Risk                       | Implemented control                                                                                                                                             | Evidence                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Webhook spoofing           | Raw-body HMAC-SHA256, constant-time comparison, fail-closed provider config                                                                                     | invalid signature E2E                                  |
| Replay/concurrency         | timestamp tolerance plus unique provider/event ID and payload-hash binding                                                                                      | stale timestamp, concurrent duplicate and mismatch E2E |
| Amount tampering           | server-owned integer VND totals; exact deposit/full/remaining comparisons                                                                                       | amount mismatch and deposit sequence E2E               |
| Reference/account mismatch | persisted unique reference and configured receiving-account comparison                                                                                          | unknown reference and account mismatch E2E             |
| Late payment               | active, unexpired reservation and payment-window checks before receipt transition                                                                               | expired reservation E2E                                |
| BOLA                       | order lookup includes owning customer ID or original guest digest                                                                                               | guest payment ownership E2E; Phase 4B order BOLA tests |
| CSRF                       | customer/guest initiation uses the existing `CartMutationGuard`; webhook uses provider authentication instead of browser CSRF                                   | existing CSRF regression suite                         |
| Fake browser success       | initiation is read-only with respect to state; storefront success comes from status polling after webhook                                                       | initiation/polling E2E and component test              |
| Duplicate payment record   | unique order payment and provider reference indexes; initiation reads the persisted record                                                                      | duplicate initiation E2E                               |
| Sensitive data/log leakage | raw body is not stored; persisted summary excludes transfer content/full account; request serializer excludes body; secrets use redaction                       | logging unit test and schema projection                |
| Mass assignment/NoSQL      | strict DTO validation, unknown-field rejection and explicit query mapping                                                                                       | global security regression suite                       |
| Resource abuse             | 1 MiB raw-body check, bounded DTOs, explicit trusted-proxy hop count and separate initiation/status Redis policies with source-global plus source/order buckets | provider guard, 120-poll and order-code rotation E2E   |

## Residual risks and limitations

- The provider HMAC implementation is based on official documentation accessed 2026-10-08 but has not been exercised against a real SePay Test-mode delivery.
- The direct VietQR image URL exposes the configured merchant account number to the customer by design; it must be a business receiving account, never a secret credential.
- The official bank-webhook payload has no separate currency field. Currency assurance relies on the provider's VND contract plus immutable internal `VND` state.
- Payment conflicts are durable, but the professional Admin reconciliation surface and audit commands belong to Phase 4D.
- No automatic refund is implemented. A late/mismatched receipt requires authorized human reconciliation.
- Application rate limits do not replace upstream DDoS protections.
- The optional Codex Security connector and Strix scan were unavailable in this environment; security evidence here is source review plus repository tests, not those external scanners.
