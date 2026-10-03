import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuditModule } from "../audit/audit.module";
import {
  Category,
  CategorySchema,
} from "../categories/schemas/category.schema";
import {
  Inventory,
  InventorySchema,
} from "../inventory/schemas/inventory.schema";
import {
  MediaAsset,
  MediaAssetSchema,
} from "../media/schemas/media-asset.schema";
import {
  ProductVariant,
  ProductVariantSchema,
} from "../variants/schemas/product-variant.schema";
import {
  AdminProductsController,
  PublicProductsController,
} from "./products.controller";
import { ProductsService } from "./products.service";
import { Product, ProductSchema } from "./schemas/product.schema";

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Category.name, schema: CategorySchema },
      { name: MediaAsset.name, schema: MediaAssetSchema },
    ]),
  ],
  controllers: [PublicProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService, MongooseModule],
})
export class ProductsModule {}
