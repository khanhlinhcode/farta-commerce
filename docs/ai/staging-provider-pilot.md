# Staging Groq provider pilot

The 2026-10-29 canary passed three public synthetic Product Advisor flows on AI build
`direct-chin-3995` (`4a6240cdfb3bd7580caca6801288b4bdbe37db59`) with exactly seven
Groq HTTP requests. It was closed and the provider was disabled. This is acceptance evidence
for the current Agent behavior, not a standing provider budget.

## Pilot configuration

- Staging only. `AI_PROVIDER_PILOT_APPROVED=true` is rejected outside staging and requires
  `AI_PROVIDER_BUDGET_ENABLED=true`.
- Use a new `AI_PROVIDER_BUDGET_CANARY_ID` beginning with `groq-pilot-`. Never reuse a canary ID
  or reset a historical Redis counter.
- Set `AI_PROVIDER_BUDGET_TTL_SECONDS=86400` and
  `AI_PROVIDER_BUDGET_MAX_REQUESTS` no greater than 30. The provider also claims a separate
  five-request/60-second Redis budget before each outbound Groq HTTP request.
- Keep `AI_PRIMARY_PROVIDER=groq`, `AI_GEMINI_ENABLED=false`,
  `AI_FALLBACK_ENABLED=false`, `AI_MAX_AGENT_ITERATIONS=2` and `AI_MAX_TOOL_EXECUTIONS=1`.
- Both budget claims occur before any provider transmission. A failure in either Redis check
  blocks the outbound request. If the daily check fails after a minute claim, the minute
  allowance is consumed conservatively; no provider request is sent.
- These are application ceilings, not Groq account limits. Recheck the account's plan, model
  access, current limits and Inference APIs Zero Data Retention before provider-on rollout.

## Rollout and containment

1. Verify the exact successful AI build and deployed SHA, healthy 1/1 replica, CI ON/CD OFF,
   API health and unchanged HMAC configuration.
2. In the AI-only Northflank Config Runtime group, edit fields individually. Keep Groq OFF
   while setting the dedicated pilot gate, new ID, daily limit and TTL. Verify the complete
   field-level diff, save, reopen and confirm persistence. Restart only AI on its active build.
3. Confirm the new daily and minute budgets are unused without resetting either counter.
4. Enable only Groq and its verified free-tier flag. Save and restart only AI on the same build.
   Send a synthetic public request and confirm grounded output, exact budget claims, no Gemini
   call and no unexpected deployment. Stop at the first error.
5. Monitor safe status/error categories, request counts, budget remaining, readiness and
   provider rate-limit responses. Never log prompts, headers, response bodies or credentials.
6. To contain the pilot, set `AI_GROQ_ENABLED=false`,
   `AI_GROQ_FREE_TIER_VERIFIED=false`, `AI_PROVIDER_BUDGET_ENABLED=false` and
   `AI_PROVIDER_PILOT_APPROVED=false`. Reopen the group, restart only AI on the same build,
   and verify the public `AI_PROVIDER_DISABLED` response. Do not reset Redis budgets.

Groq's current account limits and data controls are visible in the Groq Console. The
[rate-limit documentation](https://console.groq.com/docs/rate-limits) says exact limits can
differ by organization; the [data controls documentation](https://console.groq.com/docs/your-data)
describes Inference APIs Zero Data Retention. Account-level settings must be verified at the
time of each rollout.

## 2026-10-29 first pilot attempt

AI build `main-radiance-4665` (`19eeee8`) passed CI and was deployed with providers off.
The first public Groq search consumed one of 30 budget units and failed safely with
`AI_COMMERCE_TOOL_UNAVAILABLE`: the model's search arguments differed from the router's
fixed arguments (`ARGUMENT_MISMATCH`). Groq and the pilot budget were then disabled and the
original provider-off configuration restored. No second provider request was sent.

The next code change makes a routed `search_products` call execute the router's trusted
filters even if the model proposes different valid filters. Availability, product details
and knowledge calls continue to reject argument mismatches. A fresh live pilot must use
a new budget ID and verify the deployed build before enabling Groq again.

The second pilot on `guided-seashore-5732` (`e998b28`) confirmed public catalog search:
`completed`, one authoritative product, and no citation claim. A product material question
then returned `AI_OUTPUT_UNVERIFIED_CLAIM` with safe subtype
`CLARIFICATION_VALIDATION_BYPASS`. The RAG tool succeeded with one product citation, but
the cited public excerpt did not contain material information. Groq was disabled at this
first error; no further provider request was sent in that pilot. The follow-up change
renders a fixed, citation-free clarification when a routed knowledge call succeeds and
the model flags insufficient evidence. It discards all model-authored fields in that case.
