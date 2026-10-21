# Phase 6 external provider validation

Date: 2026-10-22

Phase 6A and Phase 6B exercised Google Gemini only with synthetic staging data. The campaigns are
reported separately because they had different approved request ceilings.

| Provider boundary              | Status           | Requests/events      | Exact blocker                                                                                                                                             |
| ------------------------------ | ---------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini `gemini-3.8-flash`      | BLOCKED          | 9 Google requests    | Phase 6A key/model/shared-secret validation passed, but the deployed Agent hit its provider deadline                                                      |
| Gemini `gemini-3.5-flash-lite` | BLOCKED          | 9–11 Google requests | Phase 6B had two successful public flows; the third failed with `AI_LIMIT_EXCEEDED`; the eight-request authorization was exceeded by at least one request |
| Groq `openai/gpt-oss-120b`     | DISABLED         | 0                    | not the selected provider; automatic fallback prohibited                                                                                                  |
| SePay Test mode                | BLOCKED          | 0 external events    | no approved Test-mode account/credential or official delivered webhook evidence                                                                           |
| Transactional email            | BLOCKED          | 0 deliveries         | no approved provider, sender domain or staging mailbox                                                                                                    |
| Google OAuth                   | DEFERRED/BLOCKED | 0 flows              | not in first-launch scope; adapter and development credentials absent                                                                                     |
| Apple OAuth                    | DEFERRED/BLOCKED | 0 flows              | not in first-launch scope; Services ID/team/key/adapter absent                                                                                            |
| Monitoring alerts              | BLOCKED          | 0 received alerts    | no approved alert sink/recipient                                                                                                                          |

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
