import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import {
  RAG_DETERMINISTIC_EMBEDDING_DIMENSIONS,
  RAG_DETERMINISTIC_EMBEDDING_MODEL,
  RAG_DETERMINISTIC_EMBEDDING_VERSION,
} from "../rag.constants";
import type { RagEmbeddingIdentity } from "../rag.types";
import type { RagEmbeddingProvider } from "./embedding-provider";

@Injectable()
export class DeterministicEmbeddingProvider implements RagEmbeddingProvider {
  readonly identity: RagEmbeddingIdentity = {
    model: RAG_DETERMINISTIC_EMBEDDING_MODEL,
    version: RAG_DETERMINISTIC_EMBEDDING_VERSION,
    dimensions: RAG_DETERMINISTIC_EMBEDDING_DIMENSIONS,
    runtimeScope: "LOCAL_ONLY",
  };

  async embed(texts: readonly string[]): Promise<number[][]> {
    return texts.map((text) => this.vector(text));
  }

  private vector(text: string): number[] {
    const normalized = text.normalize("NFKC").trim().toLocaleLowerCase("vi");
    const digest = createHash("sha256").update(normalized).digest();
    const values = Array.from(
      { length: this.identity.dimensions },
      (_, index) => (digest[index] ?? 128) - 127.5,
    );
    const magnitude = Math.sqrt(
      values.reduce((sum, value) => sum + value * value, 0),
    );
    if (magnitude === 0) return values.map(() => 0);
    return values.map((value) => Number((value / magnitude).toFixed(10)));
  }
}
