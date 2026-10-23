# Live staging recovery checkpoint

Updated: 2026-10-23

Status: **SOURCE_FIXED and OFFLINE_VERIFIED; CI, deployment and Campaign 05 are blocked at their
separate authorization gates**.

This report records the current exact-variant remediation candidate. It does not replace the
historical Phase 6B-6E reports and does not claim that this unpushed revision is deployed or has
made a live Groq request.

## Verified baseline

- branch before remediation: `main`;
- source baseline: `a8a78438d047f5029b1fb2e457bbb8a8b0055b51`;
- baseline matched `origin/main` and the worktree was clean;
- frozen Python environment: Pydantic AI `2.57.0`, Groq SDK `1.7.0`, Redis client `8.1.0` and
  HTTPX `0.28.1`;
- staging providers were documented provider-off at the baseline;
- no Groq or Gemini HTTP request was made during this remediation.

The candidate commit is intentionally not pushed or deployed in this report. Phase M requires
explicit approval of the exact commit and `farta-commerce-staging` target before push or deployment.

## Root causes and corrections

The prior availability contract retained request-bound evidence, but the NestJS tool response still
allowed aggregate product availability to stand in for exact variant authority. The Python boundary
also accepted model-selected arguments without proving that they matched the deterministic intent,
and the clarification path could bypass the normal claim checks.

The remediation now enforces all of the following:

1. NestJS normalizes requested color and size and resolves exactly one matching variant.
2. Zero matches return `NOT_FOUND`; multiple matches return `AMBIGUOUS`; neither produces product or
   availability evidence.
3. A `MATCHED` response contains exactly one matching variant and its semantic availability.
4. Python and TypeScript both apply NFKC, case-insensitive and whitespace normalization; size also
   removes a leading `size ` prefix.
5. Current-request evidence contains the resolved product slug, normalized dimensions and exact
   variant state.
6. The actual model tool and canonical arguments must match the deterministic router decision before
   any NestJS network call.
7. Model free text is not the public authority for an exact stock answer; the server renders the
   Vietnamese availability sentence from validated evidence.
8. `requires_clarification` cannot carry products, availability claims or availability language.
9. Unresolved exact variants produce deterministic clarification and cannot become `OUT_OF_STOCK`.
10. Only the intent-selected catalog tool is registered for the run. The canary stays bounded to one
    actual catalog execution and two model requests with SDK retries and fallback disabled.
11. Safe `validation_subtype` telemetry distinguishes argument, resolution and evidence failures
    without logging prompts, tool payloads or credentials.

During regression testing, a second deterministic parsing defect was found and fixed: the Vietnamese
word `không` was previously capable of contributing substring matches for color `Hồng` and size
`N`. Color extraction now uses token boundaries and size extraction requires whitespace after
`size`/`cỡ`.

## Provider-facing compatibility evidence

The locked Pydantic AI/Groq path was exercised through HTTPX `MockTransport`, so the test used the
real installed SDK serialization without contacting Groq.

- first model HTTP request: the intent-selected catalog tool is pinned by `tool_choice`; Pydantic
  AI's strict `final_result` output-tool schema is also present but is not selectable at this step;
- after one authoritative tool observation, the second request exposes only the strict
  `final_result` mechanism with `tool_choice=required`;
- exactly two mocked provider requests and one catalog execution occur;
- nested required fields, required nullable fields, enums, required arrays and
  `additionalProperties: false` are asserted;
- no third request or output-validation retry occurs.

This validates installed SDK serialization only. It is not live model-access or live output-quality
evidence.

## Commands and actual results

```text
pnpm install --frozen-lockfile                         PASS
pnpm format:check                                      PASS
pnpm lint                                              PASS
pnpm typecheck                                         PASS
pnpm test                                              PASS, 160/160
pnpm test:e2e                                          PASS, 65/65 across 7 files
pnpm build                                             PASS
pnpm audit:prod                                        PASS, no known vulnerabilities

cd apps/ai-service
uv sync --frozen                                       PASS, 53 packages audited
uv run ruff format --check .                           PASS, 34 files
uv run ruff check .                                    PASS
uv run pytest                                          PASS, 96/96
uv run python -m app.evaluation.agent_eval             PASS, 62/62, provider_calls=0

git diff --check                                       PASS
tracked changed-file high-signal secret pattern scan   PASS, no match
```

The first E2E attempt found local MongoDB/Redis unavailable, emitted Redis connection errors and
was interrupted after the suites skipped on infrastructure timeouts. `pnpm infra:up` started the
pinned local MongoDB replica set and Redis; the complete E2E command then passed 65/65. This was an
environment recovery, not a test-timeout increase.

The Storefront production build passed but warned that product sitemap page 1 was unavailable
because no local API process was serving catalog HTTP during the build. The warning does not prove
deployed sitemap completeness.

A pinned Docker Gitleaks attempt made no progress and was interrupted. No local full-history
Gitleaks pass is claimed. The exact candidate revision still requires the repository's pinned CI
`secret-scan` job after authorized push.

## Release gates

| Gate                 | Status     | Evidence or blocker                                                    |
| -------------------- | ---------- | ---------------------------------------------------------------------- |
| SOURCE               | PASS       | exact variant, argument and clarification boundaries implemented       |
| OFFLINE_TESTS        | PASS       | Node 160, API E2E 65, Python 96, evaluation 62                         |
| CI                   | BLOCKED    | candidate is not pushed; exact-revision CI does not exist              |
| DEPLOYMENT           | BLOCKED    | exact target/revision approval has not been recorded                   |
| HEALTH               | NOT_TESTED | candidate is not deployed                                              |
| SECURITY             | BLOCKED    | focused checks pass; exact-revision CI secret scan remains required    |
| PROVIDER_BUDGET      | PASS       | existing Redis pre-network/concurrency tests pass offline              |
| MODEL_ACCESS         | NOT_TESTED | no Campaign 05 provider request is authorized                          |
| PRODUCT_SEARCH       | NOT_TESTED | Campaign 05 has not run                                                |
| VARIANT_AVAILABILITY | NOT_TESTED | exact behavior passes offline only                                     |
| STYLING_ADVICE       | NOT_TESTED | Campaign 05 has not run                                                |
| UI_INTEGRATION       | NOT_TESTED | candidate is not deployed; live-provider browser traffic is prohibited |
| CANARY_ROLLBACK      | NOT_TESTED | Campaign 05 has not run                                                |
| STAGING_LIVE         | BLOCKED    | requires passing canary and separate ongoing-operation approval        |

## Authorization boundary and next action

Campaign 04 remains closed at 5/7. Campaign 05 has not been created and has consumed exactly zero
Groq requests. Its future Redis namespace must use a new ID and must not reset any historical
counter.

The next authorized action is to push the exact local candidate, wait for exact-commit CI, deploy
only `farta-api` and `farta-ai` to Northflank project `farta-commerce-staging` with all providers
disabled, and verify the provider-off runtime. A separate explicit Campaign 05 approval is still
required after that preflight; deployment approval is not provider-call approval.
