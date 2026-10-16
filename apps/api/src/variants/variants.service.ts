import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { Connection, Model } from "mongoose";

import { AuditService } from "../audit/audit.service";
import {
  isDuplicateKey,
  normalizeSku,
  objectId,
} from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import {
  Inventory,
  type InventoryDocument,
} from "../inventory/schemas/inventory.schema";
import {
  Product,
  type ProductDocument,
} from "../products/schemas/product.schema";
import { assertActiveMediaReferences } from "../media/media-reference.validator";
import {
  MediaAsset,
  type MediaAssetDocument,
} from "../media/schemas/media-asset.schema";
import type { CreateVariantDto, UpdateVariantDto } from "./dto/variant.dto";
import {
  ProductVariant,
  type ProductVariantDocument,
} from "./schemas/product-variant.schema";

type Actor = { userId: string; requestId: string };

@Injectable()
export class VariantsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ProductVariant.name)
    private readonly variants: Model<ProductVariantDocument>,
    @InjectModel(Product.name)
    private readonly products: Model<ProductDocument>,
    @InjectModel(Inventory.name)
    private readonly inventories: Model<InventoryDocument>,
    @InjectModel(MediaAsset.name)
    private readonly media: Model<MediaAssetDocument>,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(productId: string, input: CreateVariantDto, actor: Actor) {
    this.validatePrices(input.price, input.compareAtPrice ?? null);
    await this.validateImageReferences(input.mediaIds);
    const productObjectId = objectId(productId);
    const session = await this.connection.startSession();
    try {
      let result: ProductVariantDocument | undefined;
      await session.withTransaction(async () => {
        const product = await this.products
          .findOne({ _id: productObjectId, status: { $ne: "ARCHIVED" } })
          .session(session);
        if (!product) this.productNotFound();
        const [variant] = await this.variants.create(
          [
            {
              productId: productObjectId,
              sku: normalizeSku(input.sku),
              color: input.color.trim(),
              colorCode: input.colorCode ?? null,
              size: input.size.trim(),
              price: input.price,
              compareAtPrice: input.compareAtPrice ?? null,
              status: input.status ?? "ACTIVE",
              mediaIds: (input.mediaIds ?? []).map((id) => objectId(id)),
              lowStockThreshold: input.lowStockThreshold ?? 5,
              createdBy: objectId(actor.userId),
              updatedBy: objectId(actor.userId),
              archivedAt: null,
            },
          ],
          { session },
        );
        if (!variant) throw new Error("Variant creation returned no document.");
        await this.inventories.create(
          [{ variantId: variant._id, onHand: 0, reserved: 0 }],
          { session },
        );
        await this.audit.record(
          {
            action: "variant.create",
            resourceType: "ProductVariant",
            resourceId: variant.id,
            actorId: actor.userId,
            requestId: actor.requestId,
            after: {
              productId,
              sku: variant.sku,
              price: variant.price,
              status: variant.status,
            },
          },
          session,
        );
        result = variant;
      });
      if (!result) throw new Error("Variant transaction did not commit.");
      return this.response(result);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "VARIANT_SKU_CONFLICT",
          "Variant SKU is already in use.",
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async update(
    productId: string,
    variantId: string,
    input: UpdateVariantDto,
    actor: Actor,
  ) {
    if (input.status === "ARCHIVED") {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "VARIANT_STATUS_INVALID",
        "Use the archive operation to archive a variant.",
      );
    }
    const variant = await this.variants
      .findOne({ _id: objectId(variantId), productId: objectId(productId) })
      .exec();
    if (!variant) this.notFound();
    if (variant.status === "ARCHIVED") {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "VARIANT_ARCHIVED",
        "Archived variant cannot be updated.",
      );
    }
    const nextPrice = input.price ?? variant.price;
    const nextCompare =
      input.compareAtPrice === undefined
        ? variant.compareAtPrice
        : input.compareAtPrice;
    this.validatePrices(nextPrice, nextCompare);
    if (input.mediaIds !== undefined) {
      await this.validateImageReferences(input.mediaIds);
    }
    const oldPrice = variant.price;
    const oldCompareAtPrice = variant.compareAtPrice;
    if (input.sku !== undefined) variant.sku = normalizeSku(input.sku);
    if (input.color !== undefined) variant.color = input.color.trim();
    if (input.colorCode !== undefined) variant.colorCode = input.colorCode;
    if (input.size !== undefined) variant.size = input.size.trim();
    if (input.price !== undefined) variant.price = input.price;
    if (input.compareAtPrice !== undefined)
      variant.compareAtPrice = input.compareAtPrice;
    if (input.status !== undefined) variant.status = input.status;
    if (input.mediaIds !== undefined)
      variant.mediaIds = input.mediaIds.map((id) => objectId(id));
    if (input.lowStockThreshold !== undefined)
      variant.lowStockThreshold = input.lowStockThreshold;
    variant.updatedBy = objectId(actor.userId);
    try {
      await variant.save();
      await this.audit.record({
        action:
          oldPrice !== variant.price ||
          oldCompareAtPrice !== variant.compareAtPrice
            ? "variant.price-change"
            : "variant.update",
        resourceType: "ProductVariant",
        resourceId: variant.id,
        actorId: actor.userId,
        requestId: actor.requestId,
        before: {
          sku: variant.sku,
          price: oldPrice,
          compareAtPrice: oldCompareAtPrice,
        },
        after: {
          sku: variant.sku,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          status: variant.status,
        },
      });
      return this.response(variant);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "VARIANT_SKU_CONFLICT",
          "Variant SKU is already in use.",
        );
      }
      throw error;
    }
  }

  async archive(
    productId: string,
    variantId: string,
    actor: Actor,
  ): Promise<void> {
    const variant = await this.variants.findOneAndUpdate(
      {
        _id: objectId(variantId),
        productId: objectId(productId),
        status: { $ne: "ARCHIVED" },
      },
      {
        $set: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedBy: objectId(actor.userId),
        },
      },
      { returnDocument: "after" },
    );
    if (!variant) this.notFound();
    await this.audit.record({
      action: "variant.archive",
      resourceType: "ProductVariant",
      resourceId: variant.id,
      actorId: actor.userId,
      requestId: actor.requestId,
      after: { status: "ARCHIVED", sku: variant.sku },
    });
  }

  async list(productId: string) {
    const items = await this.variants
      .find({ productId: objectId(productId) })
      .sort({ color: 1, size: 1, _id: 1 });
    return { items: items.map((variant) => this.response(variant)) };
  }

  private response(variant: ProductVariantDocument) {
    return {
      id: variant.id,
      productId: variant.productId.toString(),
      sku: variant.sku,
      color: variant.color,
      colorCode: variant.colorCode,
      size: variant.size,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      currency: "VND" as const,
      status: variant.status,
      mediaIds: variant.mediaIds.map(String),
      lowStockThreshold: variant.lowStockThreshold,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
    };
  }

  private validatePrices(price: number, compareAtPrice: number | null): void {
    if (
      !Number.isSafeInteger(price) ||
      (compareAtPrice !== null &&
        (!Number.isSafeInteger(compareAtPrice) || compareAtPrice <= price))
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "VARIANT_PRICE_INVALID",
        "Variant prices are invalid.",
      );
    }
  }

  private async validateImageReferences(
    mediaIds: readonly string[] | undefined,
  ): Promise<void> {
    await assertActiveMediaReferences(
      this.media,
      mediaIds ?? [],
      "image",
      "VARIANT_MEDIA_INVALID",
      "Variant media must reference active image assets.",
    );
  }

  private productNotFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "PRODUCT_NOT_FOUND",
      "Product was not found.",
    );
  }
  private notFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "VARIANT_NOT_FOUND",
      "Variant was not found.",
    );
  }
}
