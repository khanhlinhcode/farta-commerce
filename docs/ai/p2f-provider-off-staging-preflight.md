# P2-F provider-off staging preflight

Status: historical preflight; provider-off P2-F deployment was subsequently completed and verified

This document records the provider-off deployment boundary used before the current P2-G work. It is
not current authorization for a cloud change. P2-G staging RAG preview/backfill/activation remains a
separate gated operation; see [`p2g-staging-rag-readiness.md`](p2g-staging-rag-readiness.md).

## Release invariant

- `AI_RAG_ENABLED=false` in staging for provider-off deployment. Current validators still reject
  production activation; staging now additionally requires the explicit approval/profile gates.
- Groq, Gemini, fallback and budget/provider controls remain off. Provider calls must remain zero.
- The dedicated HMAC v2 group and Reservation Expiry configuration remain unchanged.
- Deploy only immutable API and AI builds created from one reviewed commit. Do not rebuild or
  deploy the Reservation Expiry job.
- Do not run `indexes:staging`, `rag:rebuild:local`, a backfill, seed or migration. Deployed MongoDB
  configuration has `autoIndex=false`, so the disabled RAG foundation does not require a database
  mutation.
- The local rebuild command independently refuses non-loopback MongoDB targets; this guard is not
  permission to execute it during staging deployment.

## Evidence required before deployment

1. Review and commit the complete P2 working-tree diff, then push the exact commit by explicit
   approval.
2. GitHub CI must pass for that exact commit, including Node quality, API E2E, Python quality,
   complete-history secret scan, Product Advisor evaluation, knowledge-agent evaluation and
   deterministic RAG evaluation.
3. Revoke or otherwise invalidate the Northflank CLI login session potentially exposed during P1.
   Reauthenticate through a protected operator-only flow and identify the new context by nonsecret
   metadata. A local logout alone is not evidence of server-side invalidation.
4. Capture the current active API and AI build IDs/SHA, health, replica counts, CI/CD state and a
   rollback target. Confirm Reservation Expiry has no pending deployment.
5. Confirm the effective flag names and values through a masked/names-only Dashboard inspection;
   never retrieve a full runtime environment.

## Staging execution boundary

When separately authorized, deploy API and AI builds from the same approved P2 commit with CD kept
off. Keep public AI provider-off throughout the transition. After each workload change, verify the
active build/SHA, 1/1 readiness, deployment events and absence of unexpected Reservation Expiry
activity. Stop on any build/SHA drift.

## Acceptance and rollback

- API and AI liveness/readiness return HTTP 200 with no restart loop.
- Catalog read-only smoke remains healthy and provider-off synthetic chat returns the expected safe
  response without a Groq or Gemini request.
- Both HMAC directions are reverified only through separately approved bounded tests if either
  service restarts.
- RAG stays disabled and no RAG collection/index is created or modified.
- Roll back to the pre-recorded healthy API and AI builds if readiness, authentication, provider-off
  behavior or catalog smoke fails. Do not restore compromised credentials and do not change the
  Reservation Expiry job.

## Historical blockers at this checkpoint

- The P2 changes have no immutable Git SHA or Northflank build yet.
- The active Northflank CLI credential is a live session, while server-side containment of the
  previously exposed login/session credential is not evidenced.
- GitHub CI cannot attest to uncommitted local changes.

These blockers describe the pre-deployment checkpoint only. They must not be reused as evidence for
the later P2-G database mutation gate.
