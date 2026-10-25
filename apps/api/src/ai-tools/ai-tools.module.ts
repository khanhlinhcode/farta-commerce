import { Module } from "@nestjs/common";

import { ProductsModule } from "../products/products.module";
import { RagModule } from "../rag/rag.module";
import { AiKnowledgeToolsService } from "./ai-knowledge-tools.service";
import { AiToolAuthGuard } from "./ai-tool-auth.guard";
import { AiToolsController } from "./ai-tools.controller";
import { AiToolsService } from "./ai-tools.service";

@Module({
  imports: [ProductsModule, RagModule],
  controllers: [AiToolsController],
  providers: [AiToolsService, AiKnowledgeToolsService, AiToolAuthGuard],
  exports: [AiToolsService, AiKnowledgeToolsService],
})
export class AiToolsModule {}
