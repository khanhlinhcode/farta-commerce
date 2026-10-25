# P2-G staging RAG readiness

Status: `CODE_READY_FOR_LOCAL_GATES`; staging RAG remains disabled and no remote rebuild is
authorized by this document

## Delivered boundary

- Offline accent-insensitive n-gram embedding; no Groq/Gemini request or credential.
- Exact index and embedding identity filters for retrieval and citation hydration.
- Stable chunk IDs plus profile-aware repair detection, compatible with the declared unique index.
- API and AI fail-closed configuration: default off, explicit staging approval, production reject.
- Two-phase staging rebuild with exact source, database, deployed-SHA and index-version binding.
- Corpus snapshots before and after reconciliation to detect concurrent catalog changes.

The corpus remains public product text only. Price, availability, customer, order, inventory and
administrative data are not indexed. Tool authority remains read-only.

## Required quality evidence

Before creating an immutable candidate commit, run the complete workspace gates:

1. format, lint, typecheck, tests, build and production dependency audit;
2. Ruff format/check, Pytest, Agent evaluation and knowledge evaluation;
3. deterministic RAG evaluation and API E2E against isolated local MongoDB/Redis;
4. a fresh security diff scan after all fixes;
5. clean Git worktree after the reviewed commit and exact-commit GitHub CI.

Provider-off deployment of the code may precede any RAG data operation. Deploying code does not
authorize preview, apply or activation.

## Remote sequence requiring separate gates

1. Verify API/AI active build, SHA, health, CI ON/CD OFF, HMAC v2 and all provider flags OFF.
2. Deploy the same reviewed commit to API and AI with `AI_RAG_ENABLED=false`; leave Reservation
   Expiry unchanged.
3. Verify health, provider-off behavior and both HMAC directions after any restart.
4. Through one bounded API-container execution, run **preview only** with transient mode/gate
   values. Record only count, source/database fingerprints, deployment SHA and index version.
5. Review the preview, database target, declared MongoDB indexes, disk headroom and rollback/
   containment plan. Obtain separate approval for apply.
6. Run apply once with the exact preview tuple. Keep public RAG disabled. Stop on any mismatch,
   partial failure or catalog drift; never proceed directly to activation.
7. Validate counts, profile identity, citations and read-only HMAC tool behavior without a live
   provider. Obtain a separate approval before setting both API and AI RAG gates ON.

## Containment and rollback

- Before apply: stop without writes on any project/service/SHA/database/index/corpus mismatch.
- During apply: a failure may leave a partial new profile, but retrieval remains inaccessible while
  `AI_RAG_ENABLED=false`; fix the cause and rerun the same idempotent build after a new preview.
- Never drop RAG collections, delete historical rows or restore stale credentials as an automatic
  rollback.
- If activation fails, restore only the RAG enable/approval flags to OFF and restart only the
  affected API/AI services on the same immutable build. Reservation Expiry is outside the blast
  radius.

## Current stop point

No staging database preview or mutation has been run. RAG activation and live provider evaluation
remain intentionally separate. Production RAG is blocked by code and requires a new architecture,
provider, capacity/security review and explicit production authorization.
