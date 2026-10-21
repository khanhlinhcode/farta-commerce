# Phase 6A live Gemini staging validation

Date: 2026-10-22

Status: **BLOCKED — credential/model validated; deployed low-thinking Agent still exceeded the
bounded provider timeout**.

## Completed preflight

- repository clean and synchronized at `fa02dac877952c352c969cac59b552fb418449fd`;
- exact-commit GitHub CI `39622315388` succeeded;
- Northflank API build `positive-pull-6716` and AI build `noble-bee-885` succeeded and deployed;
- Cloudflare Storefront version `c03de7bd-cd28-447d-a105-8f647dd8395a` receives 100% traffic;
- Storefront, Admin and API live/ready returned HTTPS 200;
- exact-commit Firefox staging run `39623763468` passed 27/27 tests;
- targeted Chromium Product Advisor staging validation passed 4/4 tests;
- frozen Python sync, Ruff check/format and 43/43 Pytest tests passed;
- the 62-case evaluation passed its structural gates with 45/45 tool-selection cases and zero
  provider requests.

## Official compatibility evidence

Accessed 2026-10-21:

- <https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash>
- <https://ai.google.dev/gemini-api/docs/pricing>
- <https://ai.google.dev/gemini-api/docs/rate-limits>
- <https://ai.google.dev/gemini-api/terms>
- <https://pydantic.dev/docs/ai/models/google/>

Google documents `gemini-3.8-flash` as stable with function calling and structured outputs.
Pydantic AI documents the same model through `GoogleModel` and `GoogleProvider`. Free Tier pricing
is documented, but actual access and quotas remain project-specific and must be verified in Google
AI Studio. Google's Unpaid Services terms permit use of submitted content and responses for product
improvement and warn against submitting sensitive, confidential or personal information.

## Credential and quota checkpoint

The stakeholder supplied Google AI Studio evidence for project `farta-ai-staging-free` showing a
Free Tier quota for `gemini-3.8-flash` of 5 RPM, 250K TPM and 20 RPD, and explicitly authorized no
more than ten synthetic staging requests. The account UI also showed an exhausted prepaid-credit
warning; therefore this report does not infer paid capacity or production billing readiness.

Northflank secret metadata and effective-runtime diagnostics established all of the following
without printing raw values:

- `AI_GEMINI_API_KEY` exists only in the restricted `farta-ai-gemini-staging` group;
- the stored secret and effective container value have the same SHA-256 fingerprint;
- the value has no leading/trailing whitespace or newline;
- `AI_GATEWAY_SHARED_SECRET` and `AI_TOOLS_SHARED_SECRET` fingerprints match between NestJS and the
  private AI service;
- Google `models.list` returned HTTP 200;
- Google `models/gemini-3.8-flash` returned HTTP 200 and lists `generateContent` as supported.

The raw credential and full fingerprints are intentionally absent from this report.

## Live validation and failure evidence

Nine Google API HTTP requests were issued, all with synthetic data: two metadata requests and seven
`generateContent` calls. This remains below the approved ceiling of ten.

- the first public Agent request failed closed after 11.898 seconds;
- a direct deployed Pydantic AI diagnostic received Google HTTP 504
  `DEADLINE_EXCEEDED` after 11.274 seconds;
- a second public Agent request completed its authenticated product-search tool call, then failed
  closed while producing the final answer after 16.854 seconds;
- a minimal default-thinking request timed out client-side after 20.341 seconds;
- a minimal request with the documented `thinking_level=LOW` succeeded with HTTP 200 in 19.515
  seconds and used 5 total tokens.

Google documents `gemini-3.8-flash` as defaulting to medium thinking and supporting low, medium and
high levels. The evidence therefore isolates the problem to inference latency/capacity plus the
repository's original 12-second per-call ceiling, not to the API key, model name or signed tool
gateway.

The source remediation sets low thinking only for Google and raises bounded ceilings to 25 seconds
per LLM call, 60 seconds for the Agent run and 65 seconds for the NestJS upstream request. It does
not enable retries, fallback, extra tools or additional iterations.

Revision `3f11f5c787be0b95a9b494a54b84840214c667be` was committed, pushed and deployed to both
`farta-api` and `farta-ai`. The final public NestJS-to-AI test used one synthetic Vietnamese product
advice prompt. It returned HTTP 201 with the safe Agent envelope after 27.666 seconds, but the Agent
status was `unavailable` with `AI_PROVIDER_UNAVAILABLE`. API observability recorded 25.162 seconds.
The private AI logs showed no Tool Gateway request for this run, so the first Gemini call itself
reached the 25-second hard deadline. No grounded product or final model answer was returned.

This means the source mitigation was deployed successfully but did not make the live provider
reliable. Increasing the deadline again would only conceal the current Free Tier latency and is not
accepted as a correctness fix.

## Runtime safety state

Only non-secret flags and environment-variable names were inspected:

- `AI_ENABLED=true`;
- `AI_PRIMARY_PROVIDER=gemini`;
- `AI_GEMINI_ENABLED=false` after the live-validation rollback;
- `AI_GEMINI_FREE_TIER_VERIFIED=false` after the live-validation rollback;
- `AI_GROQ_ENABLED=false`;
- `AI_FALLBACK_ENABLED=false`;
- three iterations, three tool executions and existing timeout ceilings remain configured.

On 2026-10-22, `AI_GEMINI_API_KEY` was added through the Northflank secret manager as the only
variable in `farta-ai-gemini-staging`. The group is restricted to the private `farta-ai` service at
priority 40. Neither the key value nor any existing shared-secret value was printed or logged.

This configuration action does not enable Gemini. A value-only check confirmed the deployed
configuration still has `AI_GEMINI_ENABLED=false`, `AI_GEMINI_FREE_TIER_VERIFIED=false`,
`AI_GROQ_ENABLED=false`, and `AI_FALLBACK_ENABLED=false`.

On 2026-10-22 the deployed state was rechecked without changing provider flags:

- Storefront, Admin, API live and API ready each returned HTTP 200;
- Northflank reported successful builds and completed deployments for `farta-api` and `farta-ai`;
- a private port-forward to `farta-ai` returned HTTP 200 from `/health/live` and `/health/ready`;
- the public NestJS gateway returned two real staging products for `Tìm FARTA`, one product for
  `Tìm áo màu Đen`, and two products for `Tìm sản phẩm màu Kem`;
- all three Product Advisor responses used the deterministic route; the live Gemini request count
  therefore remained **0**.

The first two broader phrases tested (`Tìm áo màu đen dưới 500.000 đồng` and `Gợi ý sản phẩm mới`)
returned valid empty deterministic results. This is not a provider failure, but it is useful quality
evidence for the later live-provider comparison.

## Remaining blocking evidence

1. Select a lower-latency model only after its exact model ID, Pydantic AI compatibility, tool
   calling and Free Tier availability are verified and the stakeholder approves the configuration
   change; alternatively provide approved capacity for the current model.
2. Repeat one bounded public end-to-end Agent flow. One request remains from the ten-request
   authorization and was intentionally not consumed without a new technical change.
3. Confirm grounded products and a validated final response through NestJS, then return to
   provider-off unless the stakeholder explicitly approves continued staging exposure.
4. Record billing/data-governance acceptance separately before any production recommendation.

## Recommendation

Remain on provider-off staging. The deployed remediation is insufficient for the current provider
behavior. Do not start RAG, LangGraph, commerce mutations or production deployment.
