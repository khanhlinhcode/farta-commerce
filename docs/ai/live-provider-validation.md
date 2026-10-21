# Live provider validation

Date: 2026-10-22

Status: **BLOCKED — live credential/model valid; deployed Agent still exceeds the bounded provider
timeout**.

The 2026-10-21 Phase 6A preflight revalidated the official model and framework boundary:

- Google documents `gemini-3.8-flash` as a stable model with function calling and structured
  outputs;
- Pydantic AI documents `GoogleModel('gemini-3.8-flash', provider=GoogleProvider(...))`;
- the repository remains pinned to `pydantic-ai-slim[google,groq]==2.57.0`,
  `google-genai==2.31.0` and `groq==1.7.0`.

The Northflank service was temporarily enabled for the approved synthetic test and then returned to
fail-closed mode. No credential value was printed or logged.

The 2026-10-22 runtime follow-up verified both private AI health endpoints and three deterministic
catalog queries through the public NestJS gateway. These checks exercised the deployed Agent
boundary without invoking Google or Groq; the live provider request count remains zero.

## Executed validation

- Provider: Google Gemini.
- Model: `gemini-3.8-flash`.
- Fallback: disabled.
- Groq: disabled.
- Traffic: synthetic development-only prompts, no customer PII.
- Request ceiling: 10 synthetic staging requests, explicitly approved by the stakeholder.
- Requests used: 9 Google API requests, including 7 `generateContent` calls.
- Credential/model metadata: HTTP 200.
- Default-thinking generation: HTTP 504 or client timeout.
- Low-thinking minimal generation: HTTP 200 in 19.515 seconds.
- Deployed low-thinking Agent: failed closed on its first provider call at the 25-second LLM
  deadline; no Tool Gateway call or product result was produced.

## Blockers

1. The low-thinking remediation did not pass the deployed public Agent flow. The current Free Tier
   latency/capacity is not reliable within the bounded 25-second model deadline.
2. The account shows Free Tier quota and an exhausted prepaid-credit warning; production billing
   capacity is not established.
3. Formal production data-governance acceptance remains absent.

The code requires `AI_GEMINI_FREE_TIER_VERIFIED=true` and a non-empty secret before Gemini can be
enabled. It rejects automatic provider fallback. Revision `3f11f5c` was deployed to both API and AI,
then the service was rolled back to provider-off after the failed public flow. Effective flags were
verified as disabled; private AI live/ready and public API live/ready returned HTTP 200 afterward.

## Required evidence before re-enabling

Obtain explicit approval for either a separately verified lower-latency free model or provisioned
provider capacity, then repeat the bounded public Agent validation. Record exact request count,
timestamps, model ID, response status, safe latency and usage totals, grounding outcomes, refusal
outcomes and failures. Do not store the provider credential, full prompt history, raw provider
response or customer information.
