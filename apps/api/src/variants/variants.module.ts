import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuditModule } from "../audit/audit.module";
import {
  Inventory,
  InventorySchema,
} from "../inventory/schemas/inventory.schema";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import {
  ProductVariant,
  ProductVariantSchema,
} from "./schemas/product-variant.schema";
import { VariantsController } from "./variants.controller";
import { VariantsService } from "./variants.service";

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
  ],
  controllers: [VariantsController],
  providers: [VariantsService],
  exports: [VariantsService, MongooseModule],
})
export class VariantsModule {}
