# Phase 6C bounded Groq live canary

Date: 2026-10-22

Status: **BLOCKED — the single model-access request failed, so no public Agent flow was run**.

## Evidence boundary

| Boundary               | Result                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Source implementation  | commit `ef63a0ac9b65bd3024541cb82ebe341af8686c35`                                                                    |
| GitHub CI              | run `39763507810`; `node-quality`, `api-e2e`, `python-quality` and `secret-scan` passed                              |
| Northflank deployment  | exact source commit `ef63a0ac9b65bd3024541cb82ebe341af8686c35`; build `SUCCESS`; deployment `COMPLETED`; one replica |
| Groq account evidence  | stakeholder showed Free Plan and an account limit row for `openai/gpt-oss-120b`                                      |
| Live provider evidence | one metadata/model-access request; HTTP 404 `model_not_found`                                                        |
| Public Agent evidence  | not executed because the metadata checkpoint failed                                                                  |
| Final provider state   | Groq, Gemini and fallback disabled                                                                                   |

Local tests and CI prove the request-budget and Agent boundaries. They do not prove live model
access or answer quality.

## Pre-request checkpoint

The Northflank secret group `farta-ai-groq-canary` is restricted to the private `farta-ai`
service. Only variable names and non-empty status were inspected; no secret value was printed,
logged or committed.

The canary used:

```text
provider=groq
model=openai/gpt-oss-120b
canary=groq-canary-20261022-01
budget=7
budget_ttl_seconds=3600
max_agent_iterations=2
max_tool_executions=1
gemini=false
fallback=false
sdk_retries=0
```

Immediately before the first provider request, the durable Redis snapshot was `consumed=0`,
`remaining=7`, `limit=7`. The AI service was running the exact deployed source revision.

## Live result

The staging-only probe made exactly one outbound Groq request through the budgeted HTTP transport:

```bash
northflank exec service \
  --projectId farta-commerce-staging \
  --serviceId farta-ai \
  --cmd 'python -m app.evaluation.groq_canary_probe'
```

The budget claim succeeded first, producing `consumed=1`, `remaining=6`, `limit=7` and a 3600-second
TTL. Groq then returned HTTP 404 with provider code `model_not_found` for the configured model.
This establishes that a provider HTTP request was made, but it does not establish that the key's
project can access `openai/gpt-oss-120b`.

Execution stopped immediately. There was no retry, provider substitution, Gemini call or fallback.
The three required public flows therefore have these outcomes:

| Flow                                                 | Outcome | Provider requests |
| ---------------------------------------------------- | ------- | ----------------: |
| `Tìm áo màu đen size M`                              | not run |                 0 |
| `/product/dev-farta-essential-tee còn size M không?` | not run |                 0 |
| `Tư vấn một bộ trang phục tối giản để đi triển lãm`  | not run |                 0 |

Exact Groq request total: **1**.

## Rollback evidence

After the first failure, staging was restored to:

```text
AI_PRIMARY_PROVIDER=gemini
AI_GROQ_ENABLED=false
AI_GROQ_FREE_TIER_VERIFIED=false
AI_GEMINI_ENABLED=false
AI_GEMINI_FREE_TIER_VERIFIED=false
AI_FALLBACK_ENABLED=false
```

The private AI service returned `ok` for live and ready. API live/ready, Storefront and Admin each
returned HTTPS 200. A public synthetic Product Advisor request returned HTTP 201 with
`route=agent`, `status=unavailable`, `AI_PROVIDER_DISABLED` and zero products. A public catalog
request still returned data.

## Decision

Phase 6C did not satisfy the acceptance gate. Remain provider-off. Before another canary, verify
model permission for the exact API key/project in Groq, use a new canary ID/counter and obtain a
new explicit request authorization. Do not reuse or reset `groq-canary-20261022-01`.
