# Live provider validation

Updated: 2026-10-23

Status: **BLOCKED — live model/tool integration works, but no Gemini/Groq campaign has passed three
consecutive grounded public flows**.

## Phase 6D Groq Campaign 04

Campaign `groq-canary-20261023-04` ran on exact deployed source revision
`9b0ac2bbc2c1df0bc5fb563e97f0d9b3e6bf1e2a` after all offline, CI and cross-browser gates passed.
The Redis counter started at zero and the budgeted model-list request found exact model ID
`openai/gpt-oss-120b` at `1/7`.

The first public flow completed in 3.667 seconds with one `search_products` call, two model requests
and one authoritative re-hydrated product. The second flow returned in 2.661 seconds with one
`get_product_availability` call and two model requests, but the output guard rejected it as
`AI_OUTPUT_UNVERIFIED_CLAIM`. Execution stopped before the third flow. Total external Groq requests
were exactly **5/7**. There was no retry, Gemini call or fallback.

Groq and Gemini were disabled immediately afterward. The AI/API health and public catalog remained
available, while supported Product Advisor requests returned `AI_PROVIDER_DISABLED`. Campaign 04
is a partial live result, not release acceptance.

## Current candidate

- Framework: Pydantic AI `2.57.0`.
- Provider: Google Gemini.
- Model: `gemini-3.5-flash-lite`.
- Thinking level: `minimal`.
- Automatic retries/fallback: disabled.
- Traffic: synthetic development prompts only; no customer PII.
- Staging provider state after validation: disabled.

Official model documentation and the frozen Pydantic AI profile establish function-tool,
structured-output and minimal-thinking support. The deployed metadata request and a minimal typed
response succeeded. Credential values were not printed or logged.

## Public canary

The acceptance gate required three consecutive public NestJS-to-FastAPI-to-Gemini flows:

1. product search completed with one authoritative product in 4752.054 ms;
2. product availability/detail completed with one authoritative product in 6030.891 ms;
3. styling advice failed closed with `AI_LIMIT_EXCEEDED` in 5725.391 ms after three
   `search_products` calls.

Execution stopped at the first failure. The provider was rolled back to
`AI_GEMINI_ENABLED=false`, `AI_GEMINI_FREE_TIER_VERIFIED=false`, `AI_GROQ_ENABLED=false` and
`AI_FALLBACK_ENABLED=false`.

## Request-count defect

The stakeholder approved no more than eight new Google HTTP requests. The observable total is
between nine and eleven: one metadata request, one minimal typed-response request, at least two
requests for each of the first two completed Agent flows, and three requests for the failed flow.
The first two exact counts are unavailable because their request-count log events were not attached
yet.

The approved ceiling was therefore exceeded by at least one request. No further live request is
authorized. Future canaries must use an independent provider-level counter rather than estimating
requests per Agent flow.

## Source remediation and evidence boundary

Commit `e3aee164fea14832043e0455e684adfef1d872b1` hides catalog tools after the second
tool-bearing iteration when the model-request budget is three, reserving the final request for
`AgentFinalResponse`. GitHub Actions run `39694024231` passed all four jobs, and the frozen Python
suite passed 52/52 tests.

This remediation has not been live-validated and does not close the release gate by itself.

## Required evidence before re-enabling

1. obtain a new explicit synthetic-request ceiling;
2. deploy and verify the exact guarded revision with provider flags still off;
3. enable exact provider-request metering before the first call;
4. run exactly three public flows and stop at the first failure;
5. require grounded product references, validated structured responses and safe logs for all three;
6. roll back immediately unless all three consecutive flows pass.

See `docs/phase-6/live-agent-release-closure.md` for the complete source, CI, runtime and rollback
evidence.

## Phase 6C Groq checkpoint

Commit `ef63a0ac9b65bd3024541cb82ebe341af8686c35` added a Redis-backed provider HTTP-request
budget. Local gates passed, GitHub Actions run `39763507810` passed all four required jobs, and
Northflank deployed the exact commit with one replica.

Campaign 01 started at `0/7` and stopped at `1/7` after the SDK per-model endpoint encoded the
namespaced model ID and Groq returned HTTP 404. Commit
`cfb1e66fa764a9052f54b02ee388508312c2c1f7` changed the probe to `models.list()` with exact local
matching; GitHub Actions run `39767110389` passed.

Campaign 02 used a new counter. Its one model-list request verified `openai/gpt-oss-120b`; the first
public product-search flow then used two model requests and one authoritative catalog tool but
returned `AI_LIMIT_EXCEEDED`. Execution stopped at `3/7`; the other two public flows were not run,
and there was no retry, Gemini call or fallback.

The failure was reproduced offline as incorrect cumulative output-token accounting. Commit
`458d772f007e7ce086320255770905b93593d91a` keeps 768 tokens per request and bounds the two-request
run at 1536. Local gates and GitHub Actions run `39768778333` passed; Northflank deployed that exact
revision provider-off. AI/API health, Storefront, Admin and catalog returned 200, while the public
Agent returned `AI_PROVIDER_DISABLED`. Phase 6C remains **BLOCKED** until a new authorized canary
passes all three grounded flows.

Campaign 03 received a separate seven-request authorization and started at `0/7`. Exact model-list
access consumed one request. The first product-search flow consumed two model requests, executed
one authoritative `search_products` tool and again returned `AI_LIMIT_EXCEEDED`; it stopped at
`3/7` with no retry or remaining flows. Rollback restored all provider flags to false.

Commit `b3e59fb3e349e0f0eedec8f3ebfab327f429ef7d` tightened the final output tool to a strict,
all-required schema, set Groq temperature to zero and added redacted `limit_kind` observability.
Local gates and GitHub Actions run `39771314522` passed, and Northflank deployed the exact commit
provider-off. This is not live success; a future request requires a new explicit canary approval.

Commit `f2267a69fdd6d025f566c1049e49ce9f01af7b4a` then enforced deterministic Agent phases through
Pydantic AI per-step model settings: iteration one exposes only catalog function tools, while the
post-observation iteration exposes only the strict final output tool. Local gates passed with Node
157/157, API E2E 65/65, Python 67/67 and the 62-case zero-provider evaluation. GitHub Actions run
`39874294385` passed all four jobs. Northflank deployed the exact commit provider-off with one
replica; AI/API health, Storefront and Admin returned 200, and the public Agent returned
`AI_PROVIDER_DISABLED`. No new Groq request was made, so this remediation remains unverified by a
live three-flow campaign.
