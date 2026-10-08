import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module";
import {
  Inventory,
  InventorySchema,
} from "../inventory/schemas/inventory.schema";
import {
  MediaAsset,
  MediaAssetSchema,
} from "../media/schemas/media-asset.schema";
import { Product, ProductSchema } from "../products/schemas/product.schema";
import {
  ProductVariant,
  ProductVariantSchema,
} from "../variants/schemas/product-variant.schema";
import { CartCredentialService } from "./cart-credential.service";
import { CartMutationGuard } from "./cart-mutation.guard";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { Cart, CartSchema } from "./schemas/cart.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
      { name: ProductVariant.name, schema: ProductVariantSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: MediaAsset.name, schema: MediaAssetSchema },
    ]),
  ],
  controllers: [CartController],
  providers: [CartService, CartCredentialService, CartMutationGuard],
  exports: [
    CartService,
    CartCredentialService,
    CartMutationGuard,
    MongooseModule,
  ],
})
export class CartModule {}
