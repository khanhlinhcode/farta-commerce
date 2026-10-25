# RAG foundation (P2-B through local P2-E)

Status: local provider-independent ingestion, retrieval and Agent citation boundary

## Security boundary

FastAPI still has no MongoDB access. `RagModule` lives in NestJS, where the authoritative commerce
data already resides. It provides ingestion/retrieval APIs, a gated local rebuild command and one
HMAC-authenticated `search-knowledge` Tool Gateway endpoint. That endpoint and the corresponding
Pydantic AI tool are available only when `AI_RAG_ENABLED=true`; both API and AI configurations
default the flag to false and reject it in staging/production while the deterministic embedding
provider is installed.

The deterministic embedding provider is explicitly marked `productionSafe=false`. It exists to
make chunking, versioning, filtering and deletion tests reproducible without network or provider
credentials. It must not be used to claim semantic quality or to build a staging/production vector
index.

`RagRetrievalService` fails closed in staging and production while this non-production embedding is
configured. Its local hybrid scorer requires real lexical evidence before vector proximity can
produce a hit, so deterministic hash vectors cannot manufacture a citation.

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
2. derive stable document/chunk IDs and SHA-256 content hashes;
3. reject reuse of one source version with different content;
4. ignore stale projections;
5. replace the active version in one MongoDB transaction;
6. keep previous versions as `SUPERSEDED`;
7. mark removed sources `TOMBSTONED` without physical deletion.

Declared indexes ensure one active document per tenant/document identity and one chunk per document
version/ordinal. P2-B does not declare a vector or managed search index.

## Local retrieval and citation contract

The bounded local retriever reads at most 200 active `PUBLIC` chunks after tenant, locale, source
type and optional category/tag filtering. It returns at most eight deterministic hits. Every hit
contains a stable citation ID, canonical public path, source version/update time, chunk identity and
the exact evidence excerpt. Citation content is explicitly marked `UNTRUSTED_PUBLIC_CONTENT` so a
Agent must treat it as data rather than instructions.

The model may emit citation IDs only. Before a browser response is created, NestJS resolves every
ID against the current tenant's `ACTIVE`/`PUBLIC` chunks and rebuilds title, canonical path,
excerpt and version metadata from MongoDB. Duplicate, malformed, missing, superseded or tombstoned
citations fail closed. The Storefront renders only this server-authoritative citation object.

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

## Not implemented in the current local phases

- production vector/semantic retrieval and managed vector indexing;
- production hybrid ranking or reranking;
- shipping, returns, sizing or FAQ corpus content;
- production embedding provider;
- staging backfill, migration or deployment.

The local P2-E evaluation/security regression is documented in
[`p2e-evaluation-security.md`](p2e-evaluation-security.md). Production capabilities still require a
production retrieval design and separate remote-mutation approval.
