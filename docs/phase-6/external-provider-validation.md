# Phase 6 external provider validation

Updated: 2026-10-23

Phase 6A and Phase 6B exercised Google Gemini only with synthetic staging data. The campaigns are
reported separately because they had different approved request ceilings.

| Provider boundary              | Status           | Requests/events                                                | Exact blocker                                                                                                                                             |
| ------------------------------ | ---------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini `gemini-3.8-flash`      | BLOCKED          | 9 Google requests                                              | Phase 6A key/model/shared-secret validation passed, but the deployed Agent hit its provider deadline                                                      |
| Gemini `gemini-3.5-flash-lite` | BLOCKED          | 9–11 Google requests                                           | Phase 6B had two successful public flows; the third failed with `AI_LIMIT_EXCEEDED`; the eight-request authorization was exceeded by at least one request |
| Groq `openai/gpt-oss-120b`     | BLOCKED          | Campaign 01: 1; Campaign 02: 3; Campaign 03: 3; Campaign 04: 5 | Campaign 04 completed grounded search, then availability failed closed with `AI_OUTPUT_UNVERIFIED_CLAIM`                                                  |
| SePay Test mode                | BLOCKED          | 0 external events                                              | no approved Test-mode account/credential or official delivered webhook evidence                                                                           |
| Transactional email            | BLOCKED          | 0 deliveries                                                   | no approved provider, sender domain or staging mailbox                                                                                                    |
| Google OAuth                   | DEFERRED/BLOCKED | 0 flows                                                        | not in first-launch scope; adapter and development credentials absent                                                                                     |
| Apple OAuth                    | DEFERRED/BLOCKED | 0 flows                                                        | not in first-launch scope; Services ID/team/key/adapter absent                                                                                            |
| Monitoring alerts              | BLOCKED          | 0 received alerts                                              | no approved alert sink/recipient                                                                                                                          |

Local provider-shaped mocks and signed webhook tests are not external evidence. Browser return alone
does not establish payment success. Required Gemini approval conditions and official sources are in
`docs/ai/provider-compatibility-review.md` and `docs/ai/live-provider-validation.md`.

The Phase 6B count cannot honestly be reduced to one exact number. One metadata request, one minimal
structured-output request and three requests from the failed third flow are evidenced. The first
two public flows each required at least a tool-bearing request and a final-response request, but
their request-count events were unavailable before the runtime log handler was attached. The total
is therefore at least nine and at most eleven. This exceeded the approved ceiling of eight and is
recorded as a release-control defect, not a pass.

After the first functional failure, the runtime was rolled back to `AI_GEMINI_ENABLED=false`,
`AI_GEMINI_FREE_TIER_VERIFIED=false`, `AI_GROQ_ENABLED=false` and
`AI_FALLBACK_ENABLED=false`. A public supported request now returns `AI_PROVIDER_DISABLED` through
the Agent route. Secret values were never printed.

Phase 6C added an independent Redis pre-request boundary in commit
`ef63a0ac9b65bd3024541cb82ebe341af8686c35`. Campaign 01 stopped at `1/7` after an ambiguous
namespaced per-model metadata lookup. Commit `cfb1e66fa764a9052f54b02ee388508312c2c1f7` switched
to model listing; Campaign 02 then verified the exact model ID, but its first public flow failed
closed after two model requests and one catalog tool. The separate Campaign 02 counter remains
`3/7`.

Commit `458d772f007e7ce086320255770905b93593d91a` corrected the reproduced token-accounting defect;
GitHub Actions run `39768778333` passed all four jobs and Northflank deployed the exact commit with
all providers disabled. The fix is not live-validated and a new campaign requires new explicit
authorization.

Campaign 03 used a fresh counter and explicit maximum-seven-request authorization. It verified the
exact model with one request, then used two model requests and one catalog tool in the first public
flow. The safe response was `AI_LIMIT_EXCEEDED`, so execution stopped at `3/7`; flows two and three
were not run. Commit `b3e59fb3e349e0f0eedec8f3ebfab327f429ef7d` adds strict final-output schema
enforcement and safe limit-subtype telemetry. GitHub Actions `39771314522` passed and Northflank
deployed that exact commit provider-off. The remediation has no live-pass evidence.

Commit `f2267a69fdd6d025f566c1049e49ce9f01af7b4a` now separates the two bounded Agent phases at the
model interface: only catalog tools are eligible before the observation, and only the strict output
tool is eligible afterward. GitHub Actions `39874294385` passed all four jobs and Northflank
deployed the exact commit provider-off with one replica. Health and public provider-off checks
passed. This change made zero external provider requests and therefore does not change the Groq
request totals or the **BLOCKED** external-provider status.

Phase 6D deployed exact revision `9b0ac2bbc2c1df0bc5fb563e97f0d9b3e6bf1e2a` after GitHub CI runs
`39876683662`, `39877062148` and `39878630621` passed. Campaign 04 used a new Redis namespace with
a hard ceiling of seven. One model-list request verified `openai/gpt-oss-120b`; the product-search
flow then completed with one `search_products` tool, two model requests and a NestJS re-hydrated
product. The availability flow used one `get_product_availability` tool and two model requests but
returned `AI_OUTPUT_UNVERIFIED_CLAIM`. Execution stopped immediately at 5/7; the styling prompt was
not sent, and no retry, Gemini request or fallback occurred.

Rollback disabled Groq, Gemini, both provider-verification flags and fallback. API/AI health,
Storefront, Admin and catalog returned HTTP 200; the public Product Advisor returned
`AI_PROVIDER_DISABLED`. Campaign 04 is closed and its counter must not be reset or reused.
