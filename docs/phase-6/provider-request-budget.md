# Provider request budget

Updated: 2026-10-23

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

All three Phase 6C campaigns confirmed transport placement. Campaign 01 stopped at `1/7` after the
ambiguous per-model metadata error. Campaign 02 started with a new ID, spent one request on exact
model-list matching and two on the first public Agent flow, then stopped at `3/7` after
`AI_LIMIT_EXCEEDED`. Campaign 03 independently started at `0/7`, made the same bounded one-plus-two
request sequence and stopped at `3/7` after the same safe error. No counter was reset or reused.

Campaign 04 independently started at `0/7`. Exact `models.list()` matching consumed one unit, the
first completed public flow consumed two units, and the second fail-closed flow consumed two units.
The final snapshot was **5 consumed / 2 remaining / limit 7**. The third flow was not sent, the
counter was not reset, and the provider was disabled. This confirms that successful and rejected
Agent responses are both counted at the outbound HTTP boundary.

## Operational rules

1. Use a new canary ID for every separately authorized campaign.
2. Confirm the counter starts at zero before the first provider request.
3. Never run unrelated provider diagnostics inside the canary budget.
4. Stop at the first functional failure; do not retry.
5. Do not reset a non-zero counter to manufacture a fresh attempt.
6. Disable the provider after evidence collection unless continued exposure was explicitly
   authorized.

## Phase 6E checkpoint

Campaign 04 remains immutable at **5/7**. Source commit
`4e7a4df6586caec836263048a140aafeaee4b804` remediates availability grounding and is deployed
provider-off, but it does not create or consume a new budget. Phase 6E has made zero Groq/Gemini
HTTP requests. Campaign 05 requires a new canary ID and explicit stakeholder authorization before
its Redis key may be created or claimed.
