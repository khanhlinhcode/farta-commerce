# Phase 6C bounded Groq live canary

Date: 2026-10-22

Status: **BLOCKED — model access is verified, but the first public Agent flow failed and the
remediation has not received a new live-canary authorization**.

## Evidence boundary

| Boundary                      | Result                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Request-budget source         | commit `ef63a0ac9b65bd3024541cb82ebe341af8686c35`                                                             |
| Namespaced model-list fix     | commit `cfb1e66fa764a9052f54b02ee388508312c2c1f7`; GitHub Actions `39767110389` passed                        |
| Output-token accounting fix   | commit `458d772f007e7ce086320255770905b93593d91a`; GitHub Actions `39768778333` passed                        |
| Current Northflank deployment | exact commit `458d772f007e7ce086320255770905b93593d91a`; build `SUCCESS`; deployment `COMPLETED`; one replica |
| Groq account evidence         | stakeholder showed Free Plan and an account limit row for `openai/gpt-oss-120b`                               |
| Live model-access evidence    | exact model ID found by one authenticated `models.list()` request                                             |
| Public Agent evidence         | one product-search flow attempted; failed closed with `AI_LIMIT_EXCEEDED`                                     |
| Final provider state          | Groq, Gemini and fallback disabled                                                                            |

Local tests and CI prove the guards and the output-token remediation. They do not prove that the
remediated Agent passes the live three-flow release gate.

## Campaign 01 — metadata path incompatibility

Canary `groq-canary-20261022-01` started at `0/7`. Its only request used the SDK per-model metadata
endpoint, which encoded the namespaced model ID as `openai%2Fgpt-oss-120b`; Groq returned HTTP 404
`model_not_found`. Execution stopped at `1/7`, with no public flow, retry, Gemini call or fallback.

Commit `cfb1e66fa764a9052f54b02ee388508312c2c1f7` replaced this ambiguous endpoint with a bounded
model-list request and an exact local ID match.

## Campaign 02 — live Agent result

Canary `groq-canary-20261022-02` used the required staging policy:

```text
provider=groq
model=openai/gpt-oss-120b
budget=7
budget_ttl_seconds=3600
max_agent_iterations=2
max_tool_executions=1
output_token_limit_per_request=768
gemini=false
fallback=false
sdk_retries=0
```

The counter started at `0/7`. One authenticated `models.list()` request found the exact model ID,
leaving `1/7`. The first public synthetic flow then ran through
`POST https://api-staging.fartacommerce.me/api/v1/ai/chat` from the trusted Storefront origin:

| Flow                                                 | Public result                                                                     | Groq requests | Safe runtime evidence                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | ------------: | ------------------------------------------------------------------------------------- |
| `Tìm áo màu đen size M`                              | HTTP 201; `route=agent`; `status=unavailable`; `AI_LIMIT_EXCEEDED`; zero products |             2 | one `search_products` call completed in 578.423 ms; provider failed after 2042.505 ms |
| `/product/dev-farta-essential-tee còn size M không?` | not run                                                                           |             0 | stopped after the first failure                                                       |
| `Tư vấn một bộ trang phục tối giản để đi triển lãm`  | not run                                                                           |             0 | stopped after the first failure                                                       |

Campaign 02 made exactly **3** Groq HTTP requests. Its final counter is `3/7`; it must not be reset
or reused. Logs contain request IDs and conversation digests, not raw prompts, keys, cookies, HMAC
material or customer data.

## Diagnosed source defect and remediation

`AI_OUTPUT_TOKEN_LIMIT=768` was correctly sent to Groq as the per-request `max_tokens` value, but
the same value was also supplied as Pydantic AI's cumulative run-level `output_tokens_limit`.
Therefore two otherwise bounded responses competed for one request's token allowance. A local
provider-shaped regression reproduced the exact `AI_LIMIT_EXCEEDED` result with two valid
400-output-token responses: each response was below 768, while the combined 800 exceeded the
incorrect cumulative limit.

Commit `458d772f007e7ce086320255770905b93593d91a` keeps `768` as the per-request provider cap and
sets the cumulative run cap to `768 * max_agent_iterations` (1536 for this canary). Regression tests
prove that two 400-token responses complete and two 769-token responses still fail closed.

Local evidence after the fix:

- Admin 14/14, API 92/92 and Storefront 51/51 tests passed;
- API E2E/security 65/65 passed;
- build and production dependency audit passed;
- Python 66/66 passed;
- 62-case evaluation passed with route/Agent/tool-selection accuracy 1.0 and zero provider calls;
- GitHub Actions run `39768778333` passed `node-quality`, `api-e2e`, `python-quality` and
  `secret-scan`.

This remediation is deployed provider-off and is **not live-provider proof**.

## Rollback and current runtime

After Campaign 02 failed, staging was restored to:

```text
AI_PRIMARY_PROVIDER=gemini
AI_GROQ_ENABLED=false
AI_GROQ_FREE_TIER_VERIFIED=false
AI_GEMINI_ENABLED=false
AI_GEMINI_FREE_TIER_VERIFIED=false
AI_FALLBACK_ENABLED=false
```

On deployed commit `458d772f007e7ce086320255770905b93593d91a`, private AI live/ready returned 200. API live/ready, public catalog, Storefront and Admin returned HTTPS 200. A public synthetic
Product Advisor request returned HTTP 201 with `route=agent`, `status=unavailable`,
`AI_PROVIDER_DISABLED` and zero products.

## Decision

Phase 6C remains blocked because zero campaigns have produced three consecutive grounded public
flows. The source remediation is ready for a new bounded campaign, but a new canary ID and explicit
maximum-seven-request authorization are required before any further Groq call. Do not reuse either
existing counter, do not retry Campaign 02, and do not begin RAG, LangGraph, AI mutations or
production deployment.
