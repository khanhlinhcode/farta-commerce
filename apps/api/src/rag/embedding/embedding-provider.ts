import type { RagEmbeddingIdentity } from "../rag.types";

export const RAG_EMBEDDING_PROVIDER = Symbol("RAG_EMBEDDING_PROVIDER");

export interface RagEmbeddingProvider {
  readonly identity: RagEmbeddingIdentity;
  embed(texts: readonly string[]): Promise<number[][]>;
}
