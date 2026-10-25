# RAG foundation (P2-B through P2-G staging readiness)

Status: provider-independent local foundation plus a staging-only offline retrieval profile; remote
index creation/backfill and RAG activation are not yet authorized

## Security boundary

FastAPI still has no MongoDB access. `RagModule` lives in NestJS, where the authoritative commerce
data already resides. It provides ingestion/retrieval APIs, a gated local rebuild command and one
HMAC-authenticated `search-knowledge` Tool Gateway endpoint. That endpoint and the corresponding
Pydantic AI tool are available only when `AI_RAG_ENABLED=true`; both API and AI configurations
default the flag to false. Production activation is rejected unconditionally. Staging activation
requires both `AI_RAG_STAGING_APPROVED=true` and
`AI_RAG_RETRIEVAL_PROFILE=staging-ngram-v1` on the API, plus the matching explicit staging approval
on the AI service.

The deterministic embedding provider is explicitly scoped `LOCAL_ONLY`. It exists to
make chunking, versioning, filtering and deletion tests reproducible without network or provider
credentials. It must not be used to claim semantic quality or to build a staging/production vector
index.

The `STAGING_APPROVED` n-gram provider is also completely local: it normalizes Vietnamese accents,
hashes bounded word/character features into a 256-dimensional vector and makes no network request.
It is suitable only for the currently bounded staging corpus and lexical-heavy hybrid ranking. The
runtime independently rejects every retrieval profile in production.

`RagRetrievalService` fails closed in staging while the local-only embedding is configured. Its
hybrid scorer requires real lexical evidence before vector proximity can produce a hit, so a hash
collision or random vector proximity cannot manufacture a citation.

## Indexed product projection

The product source adapter projects only stable public catalog content:

- product name, short description and long description;
- public category names and IDs;
- public tags and canonical product path.

It does not project SKU, price, inventory quantity, semantic availability, ledger data, customer
data or administrative fields. Price and availability must continue to come from the existing
authoritative Commerce Tools in future phases.

The public-content policy rejects control characters, executable markup, email addresses, phone
numbers and credential-shaped assignments before a document can be projected. Errors contain only
a safe reason code and never echo rejected content.

## Versioned records

`rag_knowledge_documents` stores the canonical public document and source version.
`rag_knowledge_chunks` stores deterministic bounded chunks and embedding metadata. Both collections
include tenant, locale, audience, source type, source ID, schema/index version and public metadata.

The write lifecycle is:

1. normalize and validate the complete source;
2. derive stable document/chunk IDs and SHA-256 content hashes; chunk IDs deliberately stay stable
   across embedding/index migrations for the same source version and ordinal;
3. reject reuse of one source version with different content;
4. ignore stale projections;
5. replace the active version in one MongoDB transaction;
6. keep previous versions as `SUPERSEDED`;
7. mark removed sources `TOMBSTONED` without physical deletion.

Declared indexes ensure one active document per tenant/document identity and one chunk per document
version/ordinal. P2-B does not declare a vector or managed search index.

An index/profile-only rebuild is classified as `REPAIRED`: it updates the existing stable rows in a
transaction instead of inserting a second row that would collide with the declared unique index.

## Local retrieval and citation contract

The bounded retriever reads at most 200 active `PUBLIC` chunks after exact tenant, locale, source
type, index version, embedding model/version/dimensions and optional category/tag filtering. It
returns at most eight deterministic hits. Every hit contains a stable citation ID, canonical public
path, source version/update time, chunk identity and the exact evidence excerpt. Citation content is
explicitly marked `UNTRUSTED_PUBLIC_CONTENT` so an Agent must treat it as data rather than
instructions.

The model may emit citation IDs only. Before a browser response is created, NestJS resolves every
ID against the current tenant's `ACTIVE`/`PUBLIC` chunks and current index/embedding identity, then
rebuilds title, canonical path, excerpt and version metadata from MongoDB. Duplicate, malformed,
missing, superseded, incompatible-profile or tombstoned citations fail closed. The Storefront
renders only this server-authoritative citation object.

The current score combines lexical coverage with a small deterministic-vector term. It is a test
harness for filtering, ranking, empty results and citation correctness—not evidence of semantic
retrieval quality or production scalability.

## Local rebuild gate

The one-shot rebuild command is development-only and refuses `test`, `staging` and `production`:

```bash
cd apps/api
APP_ENV=development \
ALLOW_LOCAL_RAG_REBUILD=REBUILD_LOCAL_RAG_FOUNDATION_V1 \
pnpm rag:rebuild:local
```

The command parses `MONGODB_URI` before application startup and accepts only `mongodb://` targets
whose host is `localhost`, `127.0.0.1` or `::1`. SRV, private-network and remote hostnames fail
before NestJS opens a database connection. It projects a complete snapshot of active public
products and tombstones indexed product sources missing from that snapshot. Do not place the gate
value in a deployed environment.

## Staging preview/apply gate

`pnpm --filter @farta/api rag:rebuild:staging` is intentionally a two-step administrative command.
It must run only inside the existing `farta-api` staging workload while `AI_RAG_ENABLED=false`.
Both modes require Northflank-managed metadata to identify project `farta-commerce-staging`, service
`farta-api` and a 40-character `NF_DEPLOYMENT_SHA`.

Preview performs reads only and reports non-secret metadata:

- public source count and SHA-256 source fingerprint;
- SHA-256 fingerprint of the connected MongoDB host/database metadata (the raw host, database name
  and URI are never printed);
- deployed SHA and compiled `RAG_INDEX_VERSION`.

Apply requires those exact preview values through
`RAG_STAGING_EXPECTED_SOURCE_COUNT`, `RAG_STAGING_EXPECTED_SOURCE_FINGERPRINT`,
`RAG_STAGING_EXPECTED_DATABASE_FINGERPRINT`, `RAG_STAGING_EXPECTED_DEPLOYMENT_SHA` and
`RAG_STAGING_EXPECTED_INDEX_VERSION`, plus its distinct apply gate. Every comparison happens before
the first RAG write. After per-document transactional upserts, the command reads and fingerprints
the public source set again before and after reconciliation. Any detected concurrent catalog change
fails the run and keeps activation blocked. A failed or interrupted apply is resumable, but RAG must
remain disabled until a complete apply and acceptance checks pass.

Do not store either mode-specific gate or expected fingerprint as a persistent service variable.
Do not run apply from a rebuilt image, another service, a local shell pointed at staging, or a
different database target.

## Not implemented in the current local phases

- production vector/semantic retrieval and managed vector indexing;
- production hybrid ranking or reranking;
- shipping, returns, sizing or FAQ corpus content;
- production embedding provider, vector index and scale validation;
- an executed staging preview/backfill or enabled staging RAG runtime;
- live-provider prompt-injection validation.

The local P2-E evaluation/security regression is documented in
[`p2e-evaluation-security.md`](p2e-evaluation-security.md). Production capabilities still require a
production retrieval design and separate remote-mutation approval. The P2-G operational gate is
documented in [`p2g-staging-rag-readiness.md`](p2g-staging-rag-readiness.md).
