# Provider request budget

Date: 2026-10-22

## Purpose

`ProviderRequestBudget` prevents a bounded live-provider campaign from exceeding its authorized
HTTP-request ceiling. It is independent of Pydantic AI usage accounting and claims before the
outbound Groq HTTP transport sends a request.

## Design

- Redis key identity binds environment, provider, model and explicit canary ID.
- The stored key uses a SHA-256 identity digest; no prompt, output, API key or customer data is
  stored.
- A Lua script atomically creates/increments the counter and refuses `N+1` before network
  transmission.
- A TTL is mandatory. An existing counter is never reset silently.
- Redis failure, missing expiry or malformed state fails closed.
- Safe snapshots expose only consumed, remaining, limit and TTL.
- `BudgetedGroqHttpClient.send()` claims immediately before every Groq request, including model
  metadata calls.

The canary configuration permitted seven requests and used a 3600-second TTL. The eighth request
would have raised `AI_PROVIDER_BUDGET_EXCEEDED` locally.

## Verification

The frozen Python suite contains coverage for exact-N claims, pre-network rejection of N+1,
concurrent claims, identity binding, TTL, disabled SDK retry, safe exception mapping and redaction.
An additional Redis concurrency exercise issued 100 simultaneous claims and observed seven
accepted, 93 rejected and a final consumed count of seven.

The Phase 6C live metadata attempt confirmed transport placement: the budget event was emitted
before Groq returned its model-access error, and the final snapshot remained `1/7`.

## Operational rules

1. Use a new canary ID for every separately authorized campaign.
2. Confirm the counter starts at zero before the first provider request.
3. Never run unrelated provider diagnostics inside the canary budget.
4. Stop at the first functional failure; do not retry.
5. Do not reset a non-zero counter to manufacture a fresh attempt.
6. Disable the provider after evidence collection unless continued exposure was explicitly
   authorized.
