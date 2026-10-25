import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import {
  RAG_STAGING_NGRAM_EMBEDDING_DIMENSIONS,
  RAG_STAGING_NGRAM_EMBEDDING_MODEL,
  RAG_STAGING_NGRAM_EMBEDDING_VERSION,
} from "../rag.constants";
import type { RagEmbeddingIdentity } from "../rag.types";
import type { RagEmbeddingProvider } from "./embedding-provider";

@Injectable()
export class StagingNgramEmbeddingProvider implements RagEmbeddingProvider {
  readonly identity: RagEmbeddingIdentity = {
    model: RAG_STAGING_NGRAM_EMBEDDING_MODEL,
    version: RAG_STAGING_NGRAM_EMBEDDING_VERSION,
    dimensions: RAG_STAGING_NGRAM_EMBEDDING_DIMENSIONS,
    runtimeScope: "STAGING_APPROVED",
  };

  async embed(texts: readonly string[]): Promise<number[][]> {
    return texts.map((text) => this.vector(text));
  }

  private vector(text: string): number[] {
    const values = Array.from<number>({
      length: this.identity.dimensions,
    }).fill(0);
    for (const feature of this.features(text)) {
      const digest = createHash("sha256").update(feature).digest();
      const bucket = digest.readUInt32BE(0) % this.identity.dimensions;
      const sign = (digest[4] ?? 0) % 2 === 0 ? 1 : -1;
      values[bucket] = (values[bucket] ?? 0) + sign;
    }
    const magnitude = Math.sqrt(
      values.reduce((sum, value) => sum + value * value, 0),
    );
    if (magnitude === 0) return values;
    return values.map((value) => Number((value / magnitude).toFixed(10)));
  }

  private features(text: string): string[] {
    const normalized = text
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/đ/gi, "d")
      .toLocaleLowerCase("vi");
    const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
    return tokens.flatMap((token) => {
      const padded = `^${token}$`;
      const trigrams = Array.from(
        { length: Math.max(0, padded.length - 2) },
        (_, index) => `c3:${padded.slice(index, index + 3)}`,
      );
      return [`w:${token}`, ...trigrams];
    });
  }
}
