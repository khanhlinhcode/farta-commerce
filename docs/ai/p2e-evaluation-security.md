# P2-E local evaluation and security regression

Status: `P2E_LOCAL_EVALUATION_PASS`

This phase validates the local deterministic RAG and read-only Agent boundaries. It performs no
provider request, remote execution, staging mutation or production action. All policy/product text
in the retrieval dataset is synthetic test content and is never a source of FARTA business truth.

## Validation rubric

1. A versioned dataset measures Recall@3, Precision@3, MRR and NDCG@3 through the real
   `RagRetrievalService` implementation.
2. Tenant, locale, source type, category and tag filters prevent cross-boundary retrieval.
3. Citations remain current-request, `ACTIVE` and `PUBLIC`; malformed, duplicate, superseded,
   tombstoned and cross-tenant IDs fail closed.
4. The signed knowledge endpoint binds HMAC to the exact path/body and rejects replay; retrieved
   strings are explicitly untrusted and cannot expand the Agent tool allowlist.
5. Every deterministic evaluation reports zero provider calls.

## Retrieval evaluation

Run:

```bash
pnpm --filter @farta/api rag:evaluate:local
```

Dataset `farta-rag-eval-v1` contains 12 cases: eight ranked queries and four expected-empty/filter
isolation cases. The current local acceptance thresholds and results are:

| Gate                                           | Threshold | Local result |
| ---------------------------------------------- | --------: | -----------: |
| Mean Recall@3                                  |       1.0 |          1.0 |
| Mean precision over returned results (max K=3) |       1.0 |          1.0 |
| Mean reciprocal rank                           |       1.0 |          1.0 |
| Mean NDCG@3                                    |       1.0 |          1.0 |
| Metadata/tenant filter accuracy                |       1.0 |          1.0 |
| Expected-empty accuracy                        |       1.0 |          1.0 |
| Citation correctness                           |       1.0 |          1.0 |
| Provider calls                                 |         0 |            0 |

These perfect scores describe only the small deterministic synthetic fixture. They do not prove
semantic retrieval quality on a production corpus.

## Agent knowledge-routing evaluation

Run:

```bash
cd apps/ai-service
uv run python -m app.evaluation.knowledge_eval
```

The versioned ten-case dataset covers Vietnamese, Vietnamese without accents, English shipping,
returns and size queries, adversarial prompts and private-scope refusals. Route, tool-selection and
source-filter accuracy are 1.0. `AI_RAG_ENABLED=false` routes every supported knowledge case to a
fail-closed response, and no mutation tool is registered.

The existing 62-case Product Advisor evaluation remains independently green with zero provider
calls.

## Security validation evidence

- A real HTTP E2E call signs `POST /api/v1/internal/ai/tools/search-knowledge`, receives one public
  citation and then proves the same nonce is rejected on replay.
- The Tool Auth Guard rejects exact-path signature mismatch and fails closed when the Redis replay
  claim is unavailable.
- MongoDB E2E proves an active citation resolves, a tombstoned replacement does not, and a chunk
  belonging to another tenant cannot be resolved through the caller tenant.
- FastAPI rejects model-fabricated citation IDs and records citation evidence only for the current
  request.
- NestJS replaces model-provided citation metadata with the current `ACTIVE`/`PUBLIC` MongoDB
  record; stale IDs return a safe gateway error.
- Retrieved title/excerpt strings are labelled `UNTRUSTED_PUBLIC_CONTENT` and are serialized with
  an explicit “data, never instructions” policy. A knowledge route can invoke only the matching
  read-only knowledge tool.

## Remaining proof gaps

- Live-model resistance to indirect prompt injection is **NOT TESTED** because provider calls are
  prohibited. The structural containment and no-mutation impact boundary are tested.
- Shipping, returns, sizing and FAQ fixtures are synthetic; an approved governed corpus is still
  missing.
- Production embeddings, vector indexing, reranking, production latency/capacity and real-corpus
  quality are **NOT TESTED**.
- `AI_RAG_ENABLED` therefore remains disabled by default and rejected in staging/production.

P2-F provider-off staging deployment requires a separate review of the complete diff, migration
and index plan, governed content sources, rollback procedure and explicit remote authorization.
