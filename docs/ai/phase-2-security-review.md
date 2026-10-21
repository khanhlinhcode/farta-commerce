# AI Product Advisor Phase 2 security review

Date: 2026-10-21

## Controls verified locally

- HMAC binds timestamp, nonce, audience, method, path and raw body.
- Invalid signature, replayed nonce, expired timestamp, wrong audience, wrong method and wrong path
  are rejected.
- FastAPI `/v1/chat` is not publicly usable without the signed NestJS gateway request.
- Tool arguments and response schemas forbid unknown fields.
- Tool registry contains exactly search, product details and semantic availability.
- Tool observations label all strings as untrusted data and expose a bounded public projection.
- Agent output accepts only observed slugs and rejects unverified URLs, prices and availability
  claims in generated message text.
- Automatic provider fallback is rejected, retries remain zero/bounded and parallel tool calls are
  disabled.
- Request, model and tool counts are bounded; timeout failures return an unavailable response.
- Structured logging uses an event/field allowlist. It excludes raw prompts, conversations, auth,
  HMAC secret, cookies, PII, tool payloads and unrestricted provider output.
- Storefront uses React text rendering, not raw HTML, and is absent on Cart, Checkout and Order
  confirmation routes.
- AI service dependencies/config contain no MongoDB client or database credential.

## Findings

| Severity | Finding                                                  | Disposition                                                               |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| High     | Live Gemini data handling/account controls not approved  | BLOCKED; live provider remains off                                        |
| Medium   | Inbound nonce cache is in-process                        | Single replica only; shared replay claim required before horizontal scale |
| Medium   | No monitoring/alert sink                                 | Safe hooks implemented; alert delivery remains BLOCKED                    |
| Medium   | Live model prompt-injection behavior unmeasured          | Provider-independent filters/tests pass; live matrix remains BLOCKED      |
| Low      | Router uses bounded lexical rules and may not generalize | 62-case regression suite added; live quality evaluation still required    |

No unresolved Critical/High defect was found in the locally validated implementation itself. The
external High blocker prevents enabling a live provider or claiming production readiness.

## Not proven

- No live-provider prompt injection, malformed tool-call or rate-limit response was observed.
- No multi-replica replay test was performed.
- No production traffic, secret or customer data was used.
