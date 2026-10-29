import supportContent from "@farta/staging-knowledge";

import { ragDigest } from "../rag-identifiers";
import type { RagSourceDocument } from "../rag.types";

/** Staging-only, operator-approved support facts; never a production policy feed. */
export function stagingSupportRagSources(): RagSourceDocument[] {
  return supportContent.map((entry) => {
    const sourceVersion = `rag-staging-support-v1:${ragDigest(
      JSON.stringify({
        sourceType: entry.sourceType,
        title: entry.title,
        canonicalPath: entry.canonicalPath,
        sections: entry.sections,
        approvedAt: entry.approvedAt,
      }),
    )}`;
    const approvedAt = new Date(entry.approvedAt);
    return {
      tenantId: "farta",
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      locale: "vi",
      title: entry.title,
      canonicalPath: entry.canonicalPath,
      contentSections: [...entry.sections],
      sourceVersion,
      sourceUpdatedAt: approvedAt,
      publishedAt: approvedAt,
      metadata: { productSlug: null, categoryIds: [], tags: [] },
    };
  });
}
