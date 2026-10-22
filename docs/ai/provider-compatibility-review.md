# Provider compatibility review

Access date: 2026-10-22

Only official provider and Pydantic documentation was used for compatibility claims. Live inference
evidence is reported separately from source compatibility below.

## Installed framework compatibility

Pydantic AI `2.57.0` source/signatures were inspected from the frozen environment. The repository
uses supported constructors for `GoogleModel`, `GoogleProvider`, `GroqModel`, `GroqProvider`,
`Agent`, typed function tools and `UsageLimits`. Local construction with non-secret placeholder
keys confirmed the profiles below without a network request.

| Candidate               | Locked model profile                                                                                | Result                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `gemini-3.5-flash-lite` | tools, tool-return schema, JSON schema/object output, minimal thinking and tool combination enabled | source-compatible                       |
| `openai/gpt-oss-120b`   | tools, JSON schema/object output and graded reasoning enabled                                       | source-compatible with limitation below |

Pydantic AI uses an output tool for the bare Pydantic `AgentFinalResponse`, rather than requiring a
provider `response_format` call. This matters for Groq because Groq documents function tools and
Structured Outputs independently.

## Google Gemini

Official sources:

- <https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite>
- <https://ai.google.dev/gemini-api/docs/generate-content/function-calling>
- <https://ai.google.dev/gemini-api/docs/structured-output>
- <https://ai.google.dev/gemini-api/docs/rate-limits>
- <https://ai.google.dev/gemini-api/docs/pricing>
- <https://ai.google.dev/gemini-api/terms>
- <https://pydantic.dev/docs/ai/models/google/>

Verified documentation states:

- model ID `gemini-3.5-flash-lite` is stable and supports function calling and structured output;
- its documented thinking levels include `minimal`, which is selected for this bounded read-only flow;
- rate limits are project/tier/model dependent and the actual account limits must be checked in
  Google AI Studio; quota exhaustion returns a rate-limit error;
- a Free Tier exists, but account eligibility and actual quotas are account-specific;
- Unpaid Services may use submitted content and responses to improve Google products, and human
  reviewers may process inputs/outputs. Sensitive, confidential or personal information must not
  be sent under that policy.

The stakeholder supplied Google AI Studio evidence for a Free Tier project and explicitly approved
a bounded synthetic-data canary. No customer PII was used. The canary established that the key,
model and typed tool path work, but did not satisfy the release gate: two public flows completed and
the third ended with `AI_LIMIT_EXCEEDED` after three catalog tool calls.

Decision: **BLOCKED for continued live use**. The provider was disabled immediately after the first
functional failure. The source now reserves the final model iteration for structured output, but
that remediation has not been live-validated under a newly approved request budget.

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

The stakeholder supplied dashboard evidence that the Groq project was on Free Plan, that the model
appeared in the project's limit table, and that inference ZDR was disabled. Campaign 01's bounded
per-model metadata lookup returned HTTP 404 because the SDK encoded the namespaced ID as one path
segment. After replacing that lookup with one bounded `models.list()` call and an exact local ID
match, Campaign 02 verified `openai/gpt-oss-120b` for the configured key/project.

The first public Agent flow then executed one `search_products` tool and two model requests, but
failed closed with `AI_LIMIT_EXCEEDED`. The same symptom was reproduced offline when two individually
bounded outputs exceeded a mistakenly shared cumulative 768-token limit. Commit
`458d772f007e7ce086320255770905b93593d91a` separates the 768-token per-request cap from the
1536-token two-request run cap. It passed local and CI gates and is deployed provider-off, but has
not been live-validated.

Decision: **BLOCKED and disabled**. Model access is verified; three consecutive grounded public
flows are not.

## Required live-request approval checkpoint

Before any call, record and approve all of the following:

1. exact request count and request-level telemetry enabled before the first call;
2. provider/model (`Google Gemini`, `gemini-3.5-flash-lite` approved candidate);
3. actual Free Tier eligibility and current quota from the account dashboard;
4. billing disabled or an explicit bounded spend control;
5. development-only synthetic prompts with no customer PII.

No model ID, retry policy or provider will be silently substituted. Phase 6C Campaign 01 used one
of seven authorized requests. Campaign 02 used three of seven, then rolled back at the first failed
public flow. Both counters remain non-zero and must not be reset or reused.

The Phase 6B attempt also exposed a control failure: the approved ceiling was eight Google HTTP
requests, while the observable lower bound was nine. The exact total is between nine and eleven
because model-request telemetry was not attached for the first two public flows. No further live
request is permitted until a new ceiling is approved and enforced independently of assumptions
about how many model requests one Agent run will consume.
