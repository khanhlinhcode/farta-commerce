# Phase 6D completion report

Date: 2026-10-23

Verdict: **BLOCKED — remain on staging with every LLM provider disabled**.

Shared AI replay protection, offline gates, exact-commit CI, deployment and cross-browser staging
coverage passed. Groq Campaign 04 stopped at its first functional failure: the second public flow
was rejected with `AI_OUTPUT_UNVERIFIED_CLAIM`. It made exactly five of seven authorized Groq HTTP
requests and was rolled back. This report does not claim production readiness.

## Source and commits

| Commit                                     | Purpose                                                   | CI evidence           |
| ------------------------------------------ | --------------------------------------------------------- | --------------------- |
| `46359bc52a87cfc245630c449547d721a57ca95c` | shared Redis inbound replay protection and release guards | `39876683662`, passed |
| `00e7d61b4b153e5aacddf6fec01f305e897bab79` | local browser AI replay-store configuration               | `39877062148`, passed |
| `9b0ac2bbc2c1df0bc5fb563e97f0d9b3e6bf1e2a` | provider-off browser contract and staging coverage        | `39878630621`, passed |

All three CI runs passed `node-quality`, `api-e2e`, `python-quality` and `secret-scan`. Northflank
API and AI builds deployed exact source revision `9b0ac2bbc2c1df0bc5fb563e97f0d9b3e6bf1e2a` with
one replica each.

## Shared replay protection

FastAPI inbound gateway nonces now use the existing Redis dependency and an atomic `SET NX EX`
claim. The Redis key binds the environment and inbound gateway namespace to a SHA-256 nonce digest;
raw nonces, signatures, prompts, outputs and customer data are never stored. HMAC, timestamp and
audience checks run before the claim. Redis failure or malformed replay state fails closed with a
safe service-unavailable response.

Tests cover first-use acceptance, replay rejection, concurrent duplicate claims, cross-instance
simulation, TTL, invalid-signature ordering, Redis failure and log redaction. The staging AI
service still runs one replica; the Redis implementation removes the process-local correctness
assumption if replicas are increased later.

## Offline and CI evidence

Commands executed:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm infra:up
pnpm test:e2e
pnpm infra:down
pnpm build
pnpm audit:prod

cd apps/ai-service
uv sync --frozen
uv run ruff format --check .
uv run ruff check .
uv run pytest
uv run python -m app.evaluation.agent_eval
```

Results:

- Node component/unit tests: Admin 14, API 92, Storefront 51; **157/157 passed**;
- API E2E/security: **65/65 passed**;
- Python: **73/73 passed**;
- Agent evaluation: **62/62 passed**, provider calls `0`;
- format, lint, typecheck, build and production dependency audit passed;
- production dependency audit reported no known vulnerability;
- exact-commit GitHub secret scan passed.

## Exact-revision browser evidence

All suites targeted the final staging domains with provider mode `off` and revision
`9b0ac2bbc2c1df0bc5fb563e97f0d9b3e6bf1e2a`:

| Browser  | Result                         | Evidence                                                                 |
| -------- | ------------------------------ | ------------------------------------------------------------------------ |
| Chromium | 29 passed / 2 expected skipped | local full suite                                                         |
| Firefox  | 26 passed / 1 expected skipped | GitHub Actions `39879376074`, Node from `.nvmrc`, Playwright Firefox 157 |
| WebKit   | 26 passed / 1 expected skipped | local full suite                                                         |

The local macOS Firefox launcher separately failed before page launch with `Could not find profile
folder`; it is recorded as a host limitation, not a functional failure. An official Playwright
`1.64.0` Linux container independently reproduced the Firefox result at 26 passed / 1 skipped.

Browser tests created only synthetic COD orders. Four orders left by an earlier interrupted run
were cancelled through the authorized Admin API with reason `Browser E2E cleanup`. A database
read-only audit then found zero active Browser E2E orders in the previous 24 hours; no order record
was deleted.

## Groq Campaign 04

Authorization: `groq-canary-20261023-04`, synthetic prompts only, seven-request hard ceiling, no
retry, Gemini or fallback, and mandatory rollback.

| Step                                                 | Public/provider result                                | Groq HTTP requests | Runtime evidence                                                     |
| ---------------------------------------------------- | ----------------------------------------------------- | -----------------: | -------------------------------------------------------------------- |
| `models.list()`                                      | exact `openai/gpt-oss-120b` match                     |                  1 | counter `1/7`                                                        |
| `Tìm áo màu đen size M`                              | HTTP 201, `completed`, one re-hydrated product        |                  2 | one `search_products`; public 3.667 s; provider 2202.849 ms          |
| `/product/dev-farta-essential-tee còn size M không?` | HTTP 201, `unavailable`, `AI_OUTPUT_UNVERIFIED_CLAIM` |                  2 | one `get_product_availability`; public 2.661 s; provider 1581.836 ms |
| styling flow                                         | not run                                               |                  0 | stopped immediately after the first failure                          |

Final counter: **5/7**. The counter was not reset and will not be reused. Logs contained only
allowlisted telemetry fields and conversation digests; no prompt, key, cookie, signature or PII was
recorded. Flow 1 used two model requests and one approved tool. Flow 2 also used two model requests
and one approved tool, but the grounded-output policy rejected the final text. Partial success does
not satisfy the three-consecutive-flow gate.

## Rollback evidence

The Northflank secret group remains restricted to private service `farta-ai`; the provider key was
not printed or copied into Git. After Campaign 04:

```text
AI_PRIMARY_PROVIDER=gemini
AI_GROQ_ENABLED=false
AI_GROQ_FREE_TIER_VERIFIED=false
AI_GEMINI_ENABLED=false
AI_GEMINI_FREE_TIER_VERIFIED=false
AI_FALLBACK_ENABLED=false
```

Private AI live/ready, public API live/ready, Storefront, Admin, products, categories and banners
returned HTTP 200. A supported public Agent request returned `AI_PROVIDER_DISABLED` with zero
products. Recent reservation-expiry runs remained `SUCCESS`.

## Open production blockers

- live Product Advisor: **BLOCKED** by Campaign 04 Flow 2;
- monitoring alert provider, recipient and operational owner: **BLOCKED**;
- transactional email provider, sender domain and delivery/retry evidence: **BLOCKED**;
- SePay Test-mode authenticity and delivery evidence: **BLOCKED**; COD remains the validated path;
- Google/Apple OAuth credentials and live callback evidence: **BLOCKED/deferred**;
- isolated MongoDB backup/restore and Redis recovery rehearsal: **BLOCKED**;
- physical-device and screen-reader validation: **NOT TESTED**;
- Cloudflare Free-plan capacity remains a staging risk; no plan or cache semantics were changed.

## Recommendation

**Remain provider-off and continue staging remediation.** Do not start RAG, LangGraph, production
deployment or AI commerce mutations. A future live attempt requires a new canary ID, a separate
request authorization and an offline fix for the availability-answer validation contract.
