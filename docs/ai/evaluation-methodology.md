# Vietnamese Product Advisor evaluation methodology

Dataset version: `v1`
Date: 2026-10-21

## Scope

`apps/ai-service/app/evaluation/vietnamese_product_advisor_v1.jsonl` contains 62 unique,
manually authored development-only cases. It is stored separately from system instructions,
router constants and provider response fixtures.

The 14 represented categories are search, product detail, availability, comparison, styling,
ambiguity, unsupported intent, adversarial prompt, tool failure, provider failure, Vietnamese
accents, no accents, spelling variation and multi-turn context.

Each case includes:

- stable case ID and unique user message;
- bounded conversation context and selected product slugs;
- expected route class;
- allowed read-only tools and a mandatory `all_commerce_mutations` forbidden policy;
- grounding rule, expected response status and required behavior;
- expected execution mode and whether live model inference is required.

## Predeclared structural release gates

These gates were defined before executing the v1 evaluator:

- zero commerce mutation tools allowed;
- every case forbids the full mutation tool set;
- zero unobserved product slugs accepted by Agent output validation;
- zero secret leakage in observability;
- zero tool/model limit bypass;
- zero authorization decision delegated to the LLM.

## Provider-independent measurement

Run:

```bash
cd apps/ai-service
uv run python -m app.evaluation.agent_eval
```

The evaluator validates dataset schema/uniqueness, runs the deterministic scope router once per case
and reports semantic route accuracy, Agent execution-mode accuracy, bounded tool-hint accuracy and
router p50/p95 latency. Supported product requests must resolve to `agent`; only clarification and
unsupported policy decisions may bypass the model. The evaluator performs zero model or network
calls, so it cannot establish live Agent quality without a provider.

## Live-provider measurement (blocked)

After the explicit request approval checkpoint, a separate run must measure schema-valid response,
grounded product-reference rate, unsupported/mutation refusal, hallucinated products, end-to-end,
provider and tool latency, token usage and provider error distribution. Raw artifacts must contain
no credentials, customer data or unrestricted provider payloads.

No quality or latency target beyond the structural gates will be retroactively selected after seeing
results. Product-quality thresholds require stakeholder approval after the first live baseline.
