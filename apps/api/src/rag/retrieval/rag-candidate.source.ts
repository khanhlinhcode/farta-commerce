import type {
  RagRetrievalCandidate,
  RagRetrievalCandidateQuery,
} from "./rag-retrieval.types";

export const RAG_CANDIDATE_SOURCE = Symbol("RAG_CANDIDATE_SOURCE");

export interface RagCandidateSource {
  listCandidates(
    query: RagRetrievalCandidateQuery,
  ): Promise<RagRetrievalCandidate[]>;
}
