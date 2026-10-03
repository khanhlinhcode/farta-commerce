import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuditModule } from "../audit/audit.module";
import {
  ProductVariant,
  ProductVariantSchema,
} from "../variants/schemas/product-variant.schema";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import {
  InventoryTransaction,
  InventoryTransactionSchema,
} from "./schemas/inventory-transaction.schema";
import { Inventory, InventorySchema } from "./schemas/inventory.schema";

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: Inventory.name, schema: InventorySchema },
      { name: InventoryTransaction.name, schema: InventoryTransactionSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, MongooseModule],
})
export class InventoryModule {}
