# Phase 6C bounded Groq live canary

Date: 2026-10-22

Status: **BLOCKED — model access is verified, but Campaign 03 again failed on the first public
Agent flow; zero campaigns have passed all three grounded flows**.

## Evidence boundary

| Boundary                        | Result                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Request-budget source           | commit `ef63a0ac9b65bd3024541cb82ebe341af8686c35`                                                             |
| Namespaced model-list fix       | commit `cfb1e66fa764a9052f54b02ee388508312c2c1f7`; GitHub Actions `39767110389` passed                        |
| Output-token accounting fix     | commit `458d772f007e7ce086320255770905b93593d91a`; GitHub Actions `39768778333` passed                        |
| Strict final-output remediation | commit `b3e59fb3e349e0f0eedec8f3ebfab327f429ef7d`; GitHub Actions `39771314522` passed                        |
| Current Northflank deployment   | exact commit `b3e59fb3e349e0f0eedec8f3ebfab327f429ef7d`; build `SUCCESS`; deployment `COMPLETED`; one replica |
| Groq account evidence           | stakeholder showed Free Plan and an account limit row for `openai/gpt-oss-120b`                               |
| Live model-access evidence      | exact model ID found by one authenticated `models.list()` request                                             |
| Public Agent evidence           | Campaigns 02 and 03 each stopped after the first product-search flow returned `AI_LIMIT_EXCEEDED`             |
| Final provider state            | Groq, Gemini and fallback disabled                                                                            |

Local tests and CI prove the guards and both source remediations. They do not prove that the latest
strict-output remediation passes the live three-flow release gate.

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

This remediation was live-tested by Campaign 03, but the campaign still failed before producing a
validated final response.

## Campaign 03 — bounded revalidation

The stakeholder explicitly approved canary `groq-canary-20261022-03` for at most seven Groq HTTP
requests, three synthetic public flows, stop-on-first-failure, no retry/fallback and mandatory
rollback. The counter started at `0/7`. One authenticated `models.list()` request found the exact
model ID and left `1/7`.

The first public request, `Tìm áo màu đen size M`, returned in 8.198 seconds with HTTP 201,
`route=agent`, `status=unavailable`, `AI_LIMIT_EXCEEDED`, zero products and no forbidden internal
field. Safe runtime events show one `search_products` execution in 446.408 ms and two model request
budget claims. The provider failed after 2935.103 ms. The final counter was exactly `3/7`.

The second and third flows were not run. There was no retry, Gemini request or fallback. Campaign
03 was rolled back immediately and its counter must not be reset or reused.

The deployed runtime did not yet log the safe limit subtype, so Campaign 03 alone does not prove
whether the failure was caused by request-limit continuation, structured-output validation or a
token boundary. Source commit `b3e59fb3e349e0f0eedec8f3ebfab327f429ef7d` therefore makes the
final `AgentFinalResponse` tool strict, requires every schema field, forbids extra fields, uses
Groq temperature 0, disables output retries explicitly and records only an allowlisted
`limit_kind` on future failures. This is a bounded remediation, not live-pass evidence.

Offline evidence for that commit:

- Admin 14/14, API 92/92 and Storefront 51/51 tests passed;
- API E2E/security 65/65 passed;
- build and production dependency audit passed;
- Python 67/67 passed;
- 62-case evaluation passed with zero provider calls;
- GitHub Actions run `39771314522` passed all four required jobs.

## Rollback and current runtime

After Campaign 03 failed, staging was restored to:

```text
AI_PRIMARY_PROVIDER=gemini
AI_GROQ_ENABLED=false
AI_GROQ_FREE_TIER_VERIFIED=false
AI_GEMINI_ENABLED=false
AI_GEMINI_FREE_TIER_VERIFIED=false
AI_FALLBACK_ENABLED=false
```

On deployed commit `b3e59fb3e349e0f0eedec8f3ebfab327f429ef7d`, private AI live/ready returned 200. API live/ready, public catalog, Storefront and Admin returned HTTPS 200. A public synthetic
Product Advisor request returned HTTP 201 with `route=agent`, `status=unavailable`,
`AI_PROVIDER_DISABLED` and zero products.

## Decision

Phase 6C remains blocked because zero campaigns have produced three consecutive grounded public
flows. The latest source remediation is deployed provider-off, but it has not been live-validated.
A new canary ID and explicit request authorization are required before any further Groq call. Do
not reuse or reset Campaign 01, 02 or 03, and do not begin RAG, LangGraph, AI mutations or
production deployment.

## Post-Campaign 03 deterministic phase remediation

On 2026-10-23, commit `f2267a69fdd6d025f566c1049e49ce9f01af7b4a` made the two-request
Agent contract explicit through Pydantic AI's supported per-step `model_settings` callback:

- the first model request can choose only from the three allowlisted catalog function tools;
- after the authoritative tool observation, catalog tools are hidden and the second request can
  produce only the strict `AgentFinalResponse` output tool;
- retries and fallback remain disabled, and the one-tool/two-request limits are unchanged.

Local evidence passed with Node 157/157, API E2E 65/65, Python 67/67, the 62-case evaluation with
zero provider calls, build and production dependency audit. GitHub Actions run `39874294385`
passed `node-quality`, `api-e2e`, `python-quality` and `secret-scan`.

Northflank deployed the exact commit with build `SUCCESS`, deployment `COMPLETED` and one replica.
Private AI and public API live/ready, Storefront and Admin returned HTTP 200. All provider flags
remained false and a public supported request returned `AI_PROVIDER_DISABLED`. No Groq request was
made during this remediation. This is deployed provider-off evidence, not a passing live canary;
Phase 6C remains **BLOCKED** pending a newly approved campaign ID and request budget.
