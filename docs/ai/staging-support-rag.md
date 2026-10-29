# Staging support RAG

FARTA approved the existing customer-support drafts for **staging only** on 2026-10-29.
The curated source set in `packages/staging-knowledge/content.json` publishes only facts
that can be checked against the current application. It does not invent a delivery
time, shipping rate, return window, refund method or size measurements. The longer
working drafts in `docs/business-policy-drafts/` remain local and are not the RAG feed.

| Source type       | Public staging path | Stated boundary                                                              |
| ----------------- | ------------------- | ---------------------------------------------------------------------------- |
| `SHIPPING_POLICY` | `/help/shipping`    | Standard checkout option and dynamic checkout quote; no delivery estimate    |
| `RETURN_POLICY`   | `/help/returns`     | No customer self-service return flow; no published terms or support channel  |
| `SIZE_GUIDE`      | `/help/size-guide`  | Product variant labels only; no measurement chart or fit promise             |
| `FAQ`             | `/help/faq`         | Checkout quote, authorized order-status page and public catalog capabilities |

The Storefront builds those four pages from the same package that the API indexes.
Production builds targeting a different site return 404 for these pages; local
development can render them for review. Their metadata requests no indexing.
The AI service continues to reject policy questions until
`AI_RAG_POLICY_CORPUS_APPROVED=true` on the staging AI workload. Product RAG is
independent of that flag. After activation, a policy response must cite one of
the four source IDs and paths with a version prefix derived from the curated
content. The displayed answer is the selected source excerpt, so the model
cannot add an unstated fee, deadline or promise.

## Controlled staging order

1. Keep Gemini and fallback OFF and preserve the current bounded Groq budget.
2. Build and publish the Storefront from the reviewed commit; verify all four
   `/help/...` pages return HTTP 200 and the non-staging route guard remains in place.
3. Build and deploy only the API from that same commit. Confirm its active build,
   SHA, health and unchanged runtime RAG settings.
4. In the running staging API workload, run `pnpm rag:support:staging` in
   `preview` mode with `ALLOW_STAGING_SUPPORT_RAG_REBUILD=PREVIEW_STAGING_RAG_SUPPORT_V1`.
   The script requires the Northflank project/service identity, active deployment
   SHA, staging RAG profile and approval flags. Record only the four-source count,
   existing-source count and source/database fingerprints. It refuses unknown
   active support sources and validates content without a write.
5. In a separate one-shot execution, run `apply` with
   `ALLOW_STAGING_SUPPORT_RAG_REBUILD=APPLY_STAGING_RAG_SUPPORT_V1` and the exact
   previewed count, source fingerprint, database fingerprint, deployment SHA and
   index version. Do not persist those one-shot variables in Northflank.
   Acceptance requires `sources=4 retrieval=4/4`. The apply only upserts those
   four support sources; it never reconciles or tombstones product sources.
6. Verify the four source types through the read-only HMAC Tool Gateway, then set
   `AI_RAG_POLICY_CORPUS_APPROVED=true` only on the staging AI service and restart
   that service on its existing active build. Confirm the API/AI SHAs and health.
7. Send bounded public questions for shipping, returns, size and FAQ. Require a
   valid matching citation and no unsupported deadline, amount or fit claim.

If any page, fingerprint, ingestion or retrieval check fails, leave the AI policy
gate OFF. If a problem occurs after activation, turn the AI policy gate OFF and
restart only AI on its unchanged build. Existing product RAG can remain active.
Do not enable this corpus in production or treat these staging statements as final
commercial terms.
