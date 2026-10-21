# Phase 6 external provider validation

Date: 2026-10-21

No external provider was exercised during Phase 6 source hardening.

| Provider boundary          | Status           |   Requests/events | Exact blocker                                                                                                |
| -------------------------- | ---------------- | ----------------: | ------------------------------------------------------------------------------------------------------------ |
| Gemini `gemini-3.8-flash`  | BLOCKED          |                 0 | account Free Tier/quota, billing control, data-policy acceptance and secret-manager credential not evidenced |
| Groq `openai/gpt-oss-120b` | DISABLED         |                 0 | not the selected first provider; automatic fallback prohibited                                               |
| SePay Test mode            | BLOCKED          | 0 external events | no approved Test-mode account/credential or official delivered webhook evidence                              |
| Transactional email        | BLOCKED          |      0 deliveries | no approved provider, sender domain or staging mailbox                                                       |
| Google OAuth               | DEFERRED/BLOCKED |           0 flows | not in first-launch scope; adapter and development credentials absent                                        |
| Apple OAuth                | DEFERRED/BLOCKED |           0 flows | not in first-launch scope; Services ID/team/key/adapter absent                                               |
| Monitoring alerts          | BLOCKED          | 0 received alerts | no approved alert sink/recipient                                                                             |

Local provider-shaped mocks and signed webhook tests are not external evidence. Browser return alone
does not establish payment success. Required Gemini approval conditions and official sources are in
`docs/ai/provider-compatibility-review.md` and `docs/ai/live-provider-validation.md`.
