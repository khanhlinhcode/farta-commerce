# Phase 6D production-readiness review

Date: 2026-10-23

Recommendation: **REMEDIATION REQUIRED — REMAIN ON STAGING AND PROVIDER-OFF**.

## Validated boundaries

- shared Redis replay claims protect FastAPI inbound gateway requests across replicas;
- Pydantic AI remains limited to one read-only catalog tool and two model requests for the canary;
- NestJS remains the authentication, authorization and commerce authority;
- exact-commit Node/Python/CI/security gates passed;
- Chromium, Firefox and WebKit staging suites passed with expected live-provider skips;
- Campaign 04's provider request counter stopped at 5/7 and rollback was verified;
- no AI Cart, Checkout, Order, Payment, Account or Admin mutation tool exists.

## Release findings

| Severity | Item                                                                              | Status                                         |
| -------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| Critical | none found in the validated Phase 6D source scope                                 | —                                              |
| High     | live Product Advisor availability flow rejected with `AI_OUTPUT_UNVERIFIED_CLAIM` | BLOCKED; provider off                          |
| High     | alert delivery and operational ownership absent                                   | BLOCKED for production                         |
| High     | isolated backup/restore and recovery rehearsal absent                             | BLOCKED for production                         |
| High     | online SePay launch lacks official Test-mode evidence                             | BLOCKED; COD only                              |
| Medium   | transactional email delivery/retry has no external proof                          | BLOCKED                                        |
| Medium   | OAuth provider callbacks have no credential-backed proof                          | BLOCKED/deferred                               |
| Medium   | Groq Inference API ZDR was disabled during synthetic canary                       | no PII sent; not approved for customer traffic |
| Medium   | physical-device and screen-reader validation absent                               | NOT TESTED                                     |
| Medium   | Cloudflare Free-plan capacity is not a production SLO                             | staging risk                                   |

Campaign 04 proved model access and one grounded product-search response. It did not prove three
consecutive grounded flows: the second flow failed closed and the third was not run. Source, CI,
browser and health evidence cannot substitute for this missing live behavior.

## Dependabot audit

No PR was merged or closed.

- safe/current and green: `#18` Ruff, `#17` pydantic-settings, `#16` FastAPI; each still requires
  normal dependency review because CI results predate the Phase 6D head;
- green but breaking-major/manual review: `#1` actions/checkout 7;
- failing CI: `#12` pnpm/action-setup, `#11` actions/setup-node, `#10` Mongoose, `#9` jose,
  `#8` lucide-react, `#7` cookie and `#4` setup-uv;
- breaking-major among the failing set: `#12`, `#11`, `#9` and `#7`.

## Decision

Do not send production traffic, customer PII or real payment data to the Product Advisor. Do not
enable Groq or Gemini until a new bounded campaign is approved after the availability-validation
contract is remediated offline. Monitoring, email, SePay, OAuth and recovery must retain `BLOCKED`
status until provider-backed evidence exists.
