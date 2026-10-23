# Phase 6E availability grounding contract

Updated: 2026-10-23

Status: **SOURCE AND PROVIDER-OFF DEPLOYMENT COMPLETE; LIVE REVALIDATION BLOCKED PENDING A NEW
CAMPAIGN 05 AUTHORIZATION**.

This document records the internal evidence contract added after Groq Campaign 04. It does not
claim that the remediation has passed a live Groq flow. Campaign 04 remains closed at 5/7 requests
and its counter was neither reset nor reused.

## Proven failure and root cause

Campaign 04 Flow 2 executed the authoritative `get_product_availability` tool for
`dev-farta-essential-tee`, size `M`, and then failed closed with
`AI_OUTPUT_UNVERIFIED_CLAIM`. The raw provider response was intentionally not logged, so its exact
shape remains unknown.

A deterministic provider-free regression reproduced the verified symptom. Before the fix, the
Agent had a successful current-request availability observation, but `AgentFinalResponse` could
not carry an evidence reference and `AgentState` did not retain typed availability provenance.
The final validator therefore applied a phrase-only rejection to Vietnamese availability text such
as `còn hàng`. It could not distinguish a claim grounded in `get_product_availability` from a
model-only claim.

The source data flow proved the defect:

```text
get_product_availability observation
  -> public product data only
  -> no request-bound availability evidence in AgentState
  -> final output with no provenance field
  -> phrase-only unverified-claim rejection
  -> AI_OUTPUT_UNVERIFIED_CLAIM
```

## Corrective contract

Commit `4e7a4df6586caec836263048a140aafeaee4b804` adds the smallest internal contract needed to
validate the claim:

- `AvailabilityEvidence` binds the current request ID, tool name, product slug, normalized optional
  size/color, semantic availability and a safe observation reference;
- `AgentAvailabilityClaim` makes the final structured output reference that evidence explicitly;
- the evidence ledger is request-local and is populated only by `get_product_availability`;
- NFKC, case-folding, whitespace and the existing `size ` prefix handling normalize comparisons;
- the validator requires matching observation reference, product slug, size, color and semantic
  state, and requires free-text Vietnamese output to agree with the typed claim;
- product search/detail results alone do not authorize an availability claim;
- evidence from history, another request or an unknown reference is rejected;
- exact stock quantity, SKU, ledger data, unverified prices and unverified URLs remain rejected.

The new evidence fields remain internal to the FastAPI Agent validation boundary. The public
NestJS response contract was not changed, and the evidence ledger's request binding, tool identity
and internal inventory identifiers are not exposed to the Storefront.

## Changed source files

- `apps/ai-service/app/schemas/chat.py`
- `apps/ai-service/app/agents/state.py`
- `apps/ai-service/app/tools/registry.py`
- `apps/ai-service/app/agents/executor.py`
- `apps/ai-service/tests/test_agent_executor.py`

No dependency, database schema, commerce state machine, public API contract or mutation tool was
added.

## Offline evidence

The regression was first run against the old behavior and failed exactly with
`AI_OUTPUT_UNVERIFIED_CLAIM`. After the correction:

- focused Agent executor suite: 39/39 passed;
- frozen Python suite: 87/87 passed;
- Agent evaluation: 62/62 passed with provider calls `0`;
- Node unit/component tests: Admin 14, API 92, Storefront 51; 157/157 passed;
- API E2E/security: 65/65 passed across seven files;
- Ruff format/check, pnpm format/lint/typecheck/build and production dependency audit passed;
- `pnpm audit:prod` reported no known vulnerability;
- GitHub Actions run `39885326931` passed `node-quality`, `api-e2e`, `python-quality` and
  `secret-scan` for the exact source commit.

Commands executed:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm infra:up
pnpm test:e2e
pnpm infra:down
pnpm build
pnpm audit:prod

cd apps/ai-service
uv sync --frozen
uv run ruff format --check .
uv run ruff check .
uv run pytest -q
uv run python -m app.evaluation.agent_eval
```

Local `gitleaks` was unavailable. The exact-commit GitHub `secret-scan` passed, and the staged
source diff contained no `.env`, credential, raw provider response, trace, screenshot or lockfile
change.

## Provider-off deployment evidence

Northflank API and private AI both run exact source revision
`4e7a4df6586caec836263048a140aafeaee4b804`; both builds report `SUCCESS`, deployments report
`COMPLETED`, and each service has one replica.

Provider-off runtime smoke produced:

- API live/ready: HTTP 200;
- private AI live/ready through a temporary Northflank forward: HTTP 200;
- Storefront and Admin: HTTP 200;
- products, categories and home-hero banners: HTTP 200;
- recent reservation-expiry runs: `SUCCESS`;
- a supported public Agent request: HTTP 201, `route=agent`, `status=unavailable`, zero products,
  `AI_PROVIDER_DISABLED`.

Effective safe flags remain:

```text
AI_PRIMARY_PROVIDER=gemini
AI_GROQ_ENABLED=false
AI_GROQ_FREE_TIER_VERIFIED=false
AI_GEMINI_ENABLED=false
AI_GEMINI_FREE_TIER_VERIFIED=false
AI_FALLBACK_ENABLED=false
```

The Groq key was checked only for non-empty presence in a Northflank secret group restricted to
`farta-ai`; its value and fingerprint were not printed. Phase 6E has made exactly **zero** Groq or
Gemini HTTP requests. Rollback was not needed because no provider was enabled.

## Live evidence boundary

Campaign 05 has not been created, its counter has not been created or consumed, and none of its
three synthetic public flows has run. Therefore the availability remediation is proven offline and
deployed provider-off, but it is not live-provider validated. Phase 6E remains **BLOCKED** until a
new explicitly authorized Campaign 05 produces three consecutive grounded public flows within the
seven-request ceiling and is then rolled back.
