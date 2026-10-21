# Live provider validation

Date: 2026-10-22

Status: **IN PROGRESS — live credential/model valid; Agent latency remediation pending deployed
proof**.

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
- Requests used: 8 Google API requests, including 6 `generateContent` calls.
- Credential/model metadata: HTTP 200.
- Default-thinking generation: HTTP 504 or client timeout.
- Low-thinking minimal generation: HTTP 200 in 19.515 seconds.

## Blockers

1. The low-thinking remediation has not yet passed a deployed public Agent flow.
2. The account shows Free Tier quota and an exhausted prepaid-credit warning; production billing
   capacity is not established.
3. Formal production data-governance acceptance remains absent.

The code requires `AI_GEMINI_FREE_TIER_VERIFIED=true` and a non-empty secret before Gemini can be
enabled. It rejects automatic provider fallback. The service was rolled back to provider-off after
the failed live attempts; private live/ready both returned HTTP 200 afterward.

## Required evidence after approval

Record exact request count, timestamps, model ID, response status, safe latency and usage totals,
grounding outcomes, refusal outcomes and failures. Do not store the provider credential, full prompt
history, raw provider response or customer information.
