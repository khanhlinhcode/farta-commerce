# Groq security and data review

Access date: 2026-10-22

Status: **provider disabled; live model access validated, live Agent release gate failed**.

## Official sources

- <https://console.groq.com/docs/model/openai/gpt-oss-120b>
- <https://console.groq.com/docs/rate-limits>
- <https://console.groq.com/docs/tool-use/local-tool-calling>
- <https://console.groq.com/docs/structured-outputs>
- <https://console.groq.com/docs/your-data>
- <https://pydantic.dev/docs/ai/models/groq/>

Groq documents `openai/gpt-oss-120b` with Tool Use, JSON Object and JSON Schema capabilities. The
Free Plan table listed 30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD at access time. Rate-limit
responses use HTTP 429 and documented `retry-after`/`x-ratelimit-*` headers. Pydantic documents two
SDK retries by default; this repository supplies `AsyncGroq(max_retries=0)`.

Groq documents strict Structured Outputs for this model, but strict Structured Outputs and tool use
cannot be combined in one request. FARTA uses Pydantic AI typed tools and validates the final
`AgentFinalResponse`; no provider capability is treated as commerce authorization.

## Account-specific evidence

The stakeholder supplied dashboard evidence for:

- Free Plan;
- an `openai/gpt-oss-120b` limit row;
- Global ZDR disabled;
- Inference APIs ZDR disabled;
- Batch enabled;
- Fine-tuning/LoRA enabled.

Groq documents that inference data may be retained for system reliability/abuse monitoring for up
to 30 days and that eligible customers can enable ZDR. Because inference ZDR was disabled, the
campaign was restricted to synthetic prompts and no customer PII, order, payment or account data.
Only synthetic catalog prompts were used; no customer PII was sent.

## Controls and result

- key stored only in a Northflank secret group restricted to `farta-ai`;
- secret values excluded from Git, client bundles, reports and command output;
- one replica; no automatic fallback;
- provider/Agent retries disabled;
- Redis pre-request hard ceiling of seven;
- read-only catalog tools only;
- NestJS remains responsible for authentication, tool authorization and product re-hydration.

Campaign 01's per-model metadata request returned `model_not_found` with an SDK-encoded identifier.
Campaign 02 replaced that ambiguous request with `models.list()` and found the exact
`openai/gpt-oss-120b` ID using the same bounded transport and secret. The first public Agent flow
then used exactly two model requests and one read-only catalog tool, but failed closed with
`AI_LIMIT_EXCEEDED`. Execution stopped, leaving the campaign counter at `3/7`, and Groq was
disabled immediately. The diagnosed cumulative-token accounting defect is fixed and deployed
provider-off, but it has no post-fix live evidence. This review does not approve continued staging
exposure or production use.
