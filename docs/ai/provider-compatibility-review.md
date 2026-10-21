# Provider compatibility review

Access date: 2026-10-21

Only official provider and Pydantic documentation was used. No live inference request was issued.

## Installed framework compatibility

Pydantic AI `2.57.0` source/signatures were inspected from the frozen environment. The repository
uses supported constructors for `GoogleModel`, `GoogleProvider`, `GroqModel`, `GroqProvider`,
`Agent`, typed function tools and `UsageLimits`. Local construction with non-secret placeholder
keys confirmed the profiles below without a network request.

| Candidate             | Locked model profile                                                              | Result                                  |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| `gemini-3.8-flash`    | tools, tool-return schema, JSON schema/object output and tool combination enabled | source-compatible                       |
| `openai/gpt-oss-120b` | tools, JSON schema/object output and graded reasoning enabled                     | source-compatible with limitation below |

Pydantic AI uses an output tool for the bare Pydantic `AgentFinalResponse`, rather than requiring a
provider `response_format` call. This matters for Groq because Groq documents function tools and
Structured Outputs independently.

## Google Gemini

Official sources:

- <https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash>
- <https://ai.google.dev/gemini-api/docs/generate-content/function-calling>
- <https://ai.google.dev/gemini-api/docs/structured-output>
- <https://ai.google.dev/gemini-api/docs/rate-limits>
- <https://ai.google.dev/gemini-api/docs/pricing>
- <https://ai.google.dev/gemini-api/terms>
- <https://pydantic.dev/docs/ai/models/google/>

Verified documentation states:

- model ID `gemini-3.8-flash` is stable and supports function calling and structured output;
- its thinking levels are `low`, `medium`, `high`; `minimal` is unsupported;
- rate limits are project/tier/model dependent and the actual account limits must be checked in
  Google AI Studio; quota exhaustion returns a rate-limit error;
- a Free Tier exists, but account eligibility and actual quotas are account-specific;
- Unpaid Services may use submitted content and responses to improve Google products, and human
  reviewers may process inputs/outputs. Sensitive, confidential or personal information must not
  be sent under that policy.

Decision: **BLOCKED for live requests**. Source compatibility is verified, but the stakeholder has
not yet confirmed the actual project's Free Tier status, billing state, quota and acceptance of the
Unpaid Services data policy. FARTA must not send customer PII to live validation.

## Groq

Official sources:

- <https://console.groq.com/docs/model/openai/gpt-oss-120b>
- <https://console.groq.com/docs/tool-use/local-tool-calling>
- <https://console.groq.com/docs/structured-outputs>
- <https://console.groq.com/docs/rate-limits>
- <https://console.groq.com/docs/your-data>
- <https://pydantic.dev/docs/ai/models/groq/>

Verified documentation states:

- model ID `openai/gpt-oss-120b` supports tool use, JSON Object and JSON Schema modes;
- Free Plan limits were documented as 30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD at access time;
  the account dashboard remains authoritative and a `429` response includes retry guidance;
- Groq's strict Structured Outputs cannot currently be combined with tool use;
- Groq documents local tool calling for this model and Pydantic AI's output is implemented as an
  output tool, so this repository does not request Groq `response_format` alongside tools;
- Groq says inference inputs/outputs are not retained by default, with documented exceptions and
  user-configurable Data Controls.

Decision: keep **disabled**. Phase 6 policy selects one provider only, disallows automatic fallback,
and prefers Gemini after stakeholder approval. No Groq live call was made.

## Required live-request approval checkpoint

Before any call, record and approve all of the following:

1. exact request count;
2. provider/model (`Google Gemini`, `gemini-3.8-flash` proposed);
3. actual Free Tier eligibility and current quota from the account dashboard;
4. billing disabled or an explicit bounded spend control;
5. development-only synthetic prompts with no customer PII.

No model ID, retry policy or provider will be silently substituted.
