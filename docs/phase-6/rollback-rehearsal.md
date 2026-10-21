# Phase 6 rollback rehearsal

Date: 2026-10-21

Status: **PARTIAL PASS — live-provider flag rollback executed; revision rollback remains BLOCKED**.

The validated provider-off baseline is commit
`fa02dac877952c352c969cac59b552fb418449fd`. API build `positive-pull-6716`, AI build
`noble-bee-885` and Cloudflare Storefront version `c03de7bd-cd28-447d-a105-8f647dd8395a` were healthy
after deployment.

On 2026-10-22 Gemini was temporarily enabled for bounded synthetic validation, then the priority-50
validation group was changed back to `AI_GEMINI_ENABLED=false`,
`AI_GEMINI_FREE_TIER_VERIFIED=false`, `AI_GROQ_ENABLED=false` and
`AI_FALLBACK_ENABLED=false`. The `farta-ai` service restarted successfully, effective runtime flags
matched the rollback target, and private `/health/live` plus `/health/ready` returned HTTP 200. The
credential remained in its restricted secret group and was not printed.

After deploying remediation revision `3f11f5c787be0b95a9b494a54b84840214c667be`, a second bounded
public validation still hit the 25-second provider deadline. The same provider flags were rolled
back again. Northflank effective-runtime inspection confirmed all four provider/fallback flags were
`false`; private AI live/ready and public API live/ready returned HTTP 200. The deployed application
revision remained `3f11f5c`; this was a configuration rollback, not a revision rollback.

This proves provider-flag rollback only. It does not prove application-revision, database, Redis or
Cloudflare rollback.

An approved rehearsal must record the source and target revision, deployment IDs, schema
compatibility and pre/post checks for API live/ready, Storefront, Admin, Cart continuity, owned
Order access, reservation worker and provider-off Product Advisor. It must not select a revision
known to contain the prior Worker CPU regression.
