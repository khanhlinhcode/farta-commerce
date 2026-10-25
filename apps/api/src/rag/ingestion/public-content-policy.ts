import type { RagSourceDocument, RagSourceMetadata } from "../rag.types";

const identifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/;
const unsafeMarkupPattern =
  /<(?:script|style|iframe|object|embed)\b|javascript:/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:^|\D)(?:\+?84|0)(?:[ .-]?\d){9,10}(?:\D|$)/;
const secretPattern =
  /\b(?:api[ _-]?key|access[ _-]?token|authorization|bearer|password|secret)\b\s*[:=]\s*\S+/i;

function containsControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    );
  });
}

export class RagPublicContentPolicy {
  validateAndNormalize(source: RagSourceDocument): RagSourceDocument {
    if (!identifierPattern.test(source.tenantId))
      this.reject("TENANT_ID_INVALID");
    if (!identifierPattern.test(source.sourceId))
      this.reject("SOURCE_ID_INVALID");
    if (
      source.sourceVersion.length < 1 ||
      source.sourceVersion.length > 160 ||
      containsControlCharacters(source.sourceVersion)
    ) {
      this.reject("SOURCE_VERSION_INVALID");
    }
    if (
      !source.canonicalPath.startsWith("/") ||
      source.canonicalPath.startsWith("//") ||
      source.canonicalPath.includes("..") ||
      source.canonicalPath.length > 500
    ) {
      this.reject("CANONICAL_PATH_INVALID");
    }
    if (
      Number.isNaN(source.sourceUpdatedAt.getTime()) ||
      (source.publishedAt !== null &&
        Number.isNaN(source.publishedAt.getTime()))
    ) {
      this.reject("SOURCE_DATE_INVALID");
    }

    const title = this.publicText(source.title, 200, "TITLE_INVALID");
    const contentSections = source.contentSections
      .map((section) => this.publicText(section, 20_000, "CONTENT_INVALID"))
      .filter(Boolean);
    if (contentSections.length === 0) this.reject("CONTENT_EMPTY");
    const contentLength = contentSections.reduce(
      (total, section) => total + section.length,
      0,
    );
    if (contentLength > 50_000) this.reject("CONTENT_TOO_LARGE");

    return {
      ...source,
      tenantId: source.tenantId.trim(),
      sourceId: source.sourceId.trim(),
      sourceVersion: source.sourceVersion.trim(),
      title,
      canonicalPath: source.canonicalPath.trim(),
      contentSections,
      metadata: this.metadata(source.metadata),
    };
  }

  private metadata(metadata: RagSourceMetadata): RagSourceMetadata {
    const productSlug = metadata.productSlug?.normalize("NFKC").trim() || null;
    if (
      productSlug !== null &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)
    ) {
      this.reject("PRODUCT_SLUG_INVALID");
    }
    const categoryIds = this.uniqueMetadata(metadata.categoryIds, 120);
    const tags = this.uniqueMetadata(metadata.tags, 80).map((tag) =>
      tag.toLocaleLowerCase("vi"),
    );
    return {
      productSlug,
      categoryIds: [...new Set(categoryIds)].sort(),
      tags: [...new Set(tags)].sort(),
    };
  }

  private uniqueMetadata(
    values: readonly string[],
    maxLength: number,
  ): string[] {
    if (values.length > 100) this.reject("METADATA_TOO_LARGE");
    return values.map((value) => {
      const normalized = this.publicText(value, maxLength, "METADATA_INVALID");
      if (!normalized) this.reject("METADATA_INVALID");
      return normalized;
    });
  }

  private publicText(value: string, maxLength: number, code: string): string {
    const normalized = value
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .replace(/[\t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (
      normalized.length > maxLength ||
      containsControlCharacters(normalized) ||
      unsafeMarkupPattern.test(normalized) ||
      emailPattern.test(normalized) ||
      phonePattern.test(normalized) ||
      secretPattern.test(normalized)
    ) {
      this.reject(code);
    }
    return normalized;
  }

  private reject(code: string): never {
    throw new Error(`RAG_PUBLIC_CONTENT_REJECTED:${code}`);
  }
}
