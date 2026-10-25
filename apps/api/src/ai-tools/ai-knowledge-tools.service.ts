import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AiKnowledgeToolResponse } from "@farta/types";

import type { Environment } from "../config/environment";
import { RagRetrievalService } from "../rag/retrieval/rag-retrieval.service";
import type { SearchKnowledgeToolDto } from "./dto/ai-tool.dto";

@Injectable()
export class AiKnowledgeToolsService {
  private readonly enabled: boolean;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(RagRetrievalService)
    private readonly retrieval: RagRetrievalService,
  ) {
    this.enabled = config.get("AI_RAG_ENABLED", { infer: true });
  }

  async search(
    input: SearchKnowledgeToolDto,
  ): Promise<AiKnowledgeToolResponse> {
    if (!this.enabled) {
      throw new ServiceUnavailableException("AI knowledge tool is disabled.");
    }
    const result = await this.retrieval.retrieve({
      tenantId: "farta",
      query: input.query,
      locale: input.locale,
      sourceTypes: input.sourceTypes,
      ...(input.categoryIds ? { categoryIds: input.categoryIds } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
      limit: input.limit,
    });
    return {
      tool: "search_knowledge",
      citations: result.hits.map(({ citation }) => citation),
    };
  }
}
