import { Module } from "@nestjs/common";

import { ProductsModule } from "../products/products.module";
import { AiToolAuthGuard } from "./ai-tool-auth.guard";
import { AiToolsController } from "./ai-tools.controller";
import { AiToolsService } from "./ai-tools.service";

@Module({
  imports: [ProductsModule],
  controllers: [AiToolsController],
  providers: [AiToolsService, AiToolAuthGuard],
  exports: [AiToolsService],
})
export class AiToolsModule {}
