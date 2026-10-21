# Phase 6B live Agent release closure

Date: 2026-10-22

Status: **BLOCKED — source and deployment boundaries are implemented, but the live release gate did
not pass**.

The Gemini provider is disabled in staging. This report does not claim production readiness or a
completed live Product Advisor release.

## 1. Implemented source architecture

Supported Product Advisor requests now follow:

```text
Deterministic scope/clarification router
  -> Pydantic AI Agent
  -> typed read-only catalog tools
  -> HMAC-authenticated NestJS Tool Gateway
  -> validated AgentFinalResponse
  -> authoritative NestJS product re-hydration
```

The router no longer produces a deterministic catalog answer. With providers disabled, supported
requests fail closed with `AI_PROVIDER_DISABLED`. The Agent has no database credential and has no
Cart, Checkout, Order, Payment, Account or Admin mutation tool.

The configured bounds are three model requests, three tool executions, 768 output tokens, a
25-second model timeout and a 60-second Agent timeout. Retries and provider fallback are disabled.
After the canary failure, commit `e3aee164fea14832043e0455e684adfef1d872b1` added a stricter
execution guard: with a three-request budget, catalog tools are hidden after the second tool-bearing
iteration so the final request remains available for `AgentFinalResponse`.

## 2. Source, CI and deployment revisions

| Revision                                   | Purpose                                                        | CI evidence                                           |
| ------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------- |
| `af74e419d91e9739b12eb823c6be75440161873f` | live Pydantic AI routing and `gemini-3.5-flash-lite` candidate | GitHub Actions `39692046696`, success                 |
| `9c6ef03f4927ca5512bd1ee489513b1263177c34` | safe runtime observability persistence                         | GitHub Actions `39692934702`, success                 |
| `aedc0a954c6d70d2b749459822dad353815a1944` | attach the AI log handler                                      | GitHub Actions `39693309688`, success                 |
| `e3aee164fea14832043e0455e684adfef1d872b1` | reserve the final Agent response iteration                     | GitHub Actions `39694024231`, all four jobs succeeded |

The live canary ran on deployed AI revision
`aedc0a954c6d70d2b749459822dad353815a1944`. The final-iteration guard was not part of that canary.
It must not be described as live-validated. Northflank subsequently deployed guarded revision
`e3aee164fea14832043e0455e684adfef1d872b1` with the provider still disabled; build and deployment
both completed with one replica.

## 3. Local verification evidence

Commands executed against the frozen repository environments:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm --filter @farta/admin test
pnpm --filter @farta/api test
pnpm --filter @farta/storefront test
pnpm test:e2e
pnpm build
pnpm audit:prod

cd apps/ai-service
uv sync --frozen
uv run ruff format --check .
uv run ruff check .
uv run pytest -q
uv run python -m app.evaluation.agent_eval
```

Recorded results:

- Admin: 14/14 tests passed;
- API: 92/92 tests passed;
- Storefront: 51/51 tests passed;
- API E2E/security: 65/65 tests passed across seven files;
- API, Admin and Storefront production builds passed;
- production dependency audit reported no known vulnerability;
- after the final-iteration guard, Python: 52/52 tests passed;
- Ruff format/check passed;
- evaluation: 62 cases, route accuracy 1.0, Agent execution accuracy 1.0, tool-hint
  accuracy 1.0 over 45 applicable cases, and zero provider calls.

The 62-case evaluation is structural/offline evidence. It does not measure live answer quality,
provider latency or grounded-response success.

## 4. Provider and data-policy checkpoint

The selected candidate was Google `gemini-3.5-flash-lite` through Pydantic AI `2.57.0`. Official
model documentation and the installed model profile established function-tool, structured-output
and minimal-thinking support. Google AI Studio evidence showed a Free Tier project. Unpaid Services
may process submitted data for product improvement, so only synthetic development prompts were
used; no customer PII, credentials, order data or payment data was sent.

The deployed metadata probe returned the requested model and listed `generateContent`,
`countTokens`, `createCachedContent` and `batchGenerateContent`. A minimal Pydantic AI structured
response validated successfully before the public canary.

## 5. Public canary results

The stakeholder approved at most eight new Google HTTP requests with synthetic data. The acceptance
gate required three consecutive successful public NestJS-to-FastAPI-to-Gemini Agent flows.

| Flow                        | Public result                                                             | Evidence                                                                                        |
| --------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Product search              | HTTP 201, `completed`, `route=agent`, one authoritative product           | public latency 4752.054 ms                                                                      |
| Product availability/detail | HTTP 201, `completed`, `route=agent`, one authoritative product           | public latency 6030.891 ms                                                                      |
| Styling advice              | HTTP 201 safe envelope, `unavailable`, `route=agent`, `AI_LIMIT_EXCEEDED` | public latency 5725.391 ms; three successful `search_products` calls were logged before failure |

Execution stopped after the first functional failure. No retry or fallback was used.

### Request-count control defect

The approved eight-request ceiling was exceeded. The observable Phase 6B total is between nine and
eleven Google HTTP requests:

- one model metadata request;
- one minimal structured-output request;
- at least two requests for each of the first two successful public flows;
- exactly three model requests for the failed third public flow.

The first two public flows completed before the runtime logger was correctly attached, so their
exact model-request counts are unavailable. They may have used two or three requests each. The
lower bound is therefore nine, already one above the approved ceiling. This is an authorization and
metering defect caused by estimating requests per Agent flow instead of enforcing a provider-level
counter. It is not hidden or reported as a pass.

## 6. Observability and security evidence

After the log-handler correction, safe events recorded provider/model identity, request ID,
conversation digest, route, tool name, tool/provider latency, tool count, model-request count, token
usage and normalized error code. They did not contain the raw prompt, cookies, authorization data,
HMAC material, provider key or unrestricted tool payloads.

The failed flow recorded three `search_products` executions with latencies 289.376 ms, 199.280 ms
and 199.185 ms, followed by `AI_LIMIT_EXCEEDED`. This provided the evidence for the final-iteration
guard. Existing tests continue to cover provider-off behavior, forbidden tools, output grounding,
unverified URLs/prices/availability, malformed structured output, timeout, rate limit, fallback
prohibition and tool/request limits.

## 7. Rollback and current staging state

Immediately after the failed flow, staging was set to:

```text
AI_GEMINI_ENABLED=false
AI_GEMINI_FREE_TIER_VERIFIED=false
AI_GROQ_ENABLED=false
AI_FALLBACK_ENABLED=false
```

The raw provider key was not printed. Northflank reported a completed one-replica AI deployment.
Storefront, Admin, API live and API ready each returned HTTPS 200. A real public supported Product
Advisor request returned `route=agent`, `status=unavailable` and `AI_PROVIDER_DISABLED`, confirming
that the rollback is effective without fabricating a catalog answer.

## 8. Acceptance decision

Phase 6B is **not complete**:

- only two of three required consecutive public Agent flows succeeded;
- the third flow exhausted the model-request budget;
- the approved provider request ceiling was exceeded;
- the source guard added afterward has local tests but no live-provider evidence;
- sustained Free Tier latency, quota and quality are not established.

## 9. Required next approval

Remain provider-off. A follow-up canary requires a new stakeholder-approved request budget and a
provider-level meter that stops before the ceiling independently of Agent internals. It should
deploy the guarded revision, verify exact effective flags/revision, run exactly three synthetic
public flows, stop on the first failure, and require three consecutive grounded successes before
leaving the provider enabled.

Do not begin RAG, LangGraph, AI commerce mutations or production deployment from this result.
