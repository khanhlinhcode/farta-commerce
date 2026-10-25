import { createHash } from "node:crypto";

import type { RagSourceIdentity } from "./rag.types";

export function ragDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function ragDocumentId(identity: RagSourceIdentity): string {
  return `ragdoc_${ragDigest(
    [
      identity.tenantId,
      identity.sourceType,
      identity.sourceId,
      identity.locale,
    ].join("\0"),
  )}`;
}

export function ragChunkId(
  documentId: string,
  sourceVersion: string,
  ordinal: number,
  contentHash: string,
): string {
  return `ragchunk_${ragDigest(
    [documentId, sourceVersion, String(ordinal), contentHash].join("\0"),
  )}`;
}
