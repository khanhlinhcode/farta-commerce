import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuditModule } from "../audit/audit.module";
import {
  MediaAsset,
  MediaAssetSchema,
} from "../media/schemas/media-asset.schema";
import {
  AdminCategoriesController,
  PublicCategoriesController,
} from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { Category, CategorySchema } from "./schemas/category.schema";

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: MediaAsset.name, schema: MediaAssetSchema },
    ]),
  ],
  controllers: [PublicCategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService, MongooseModule],
})
export class CategoriesModule {}
