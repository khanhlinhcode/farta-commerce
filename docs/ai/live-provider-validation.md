# Live provider validation

Date: 2026-10-22

Status: **BLOCKED — live model/tool integration works, but the Phase 6B release gate and request
budget did not pass**.

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
