import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { AuditService } from "../audit/audit.service";
import {
  isDuplicateKey,
  escapeRegex,
  normalizeSlug,
  objectId,
} from "../catalog/catalog.utils";
import type { AvailabilityStatus } from "../catalog/catalog.constants";
import { ApiException } from "../common/api-exception";
import {
  Category,
  type CategoryDocument,
} from "../categories/schemas/category.schema";
import {
  Inventory,
  type InventoryDocument,
} from "../inventory/schemas/inventory.schema";
import {
  MediaAsset,
  type MediaAssetDocument,
} from "../media/schemas/media-asset.schema";
import {
  ProductVariant,
  type ProductVariantDocument,
} from "../variants/schemas/product-variant.schema";
import type {
  CreateProductDto,
  ProductListQueryDto,
  UpdateProductDto,
} from "./dto/product.dto";
import { Product, type ProductDocument } from "./schemas/product.schema";

type Actor = { userId: string; requestId: string };
type VariantPublic = {
  id: string;
  sku: string;
  color: string;
  colorCode: string | null;
  size: string;
  price: number;
  compareAtPrice: number | null;
  currency: "VND";
  media: Array<{
    id: string;
    secureUrl: string;
    width: number;
    height: number;
    altText: string | null;
  }>;
  availability: AvailabilityStatus;
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly products: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variants: Model<ProductVariantDocument>,
    @InjectModel(Inventory.name)
    private readonly inventories: Model<InventoryDocument>,
    @InjectModel(Category.name)
    private readonly categories: Model<CategoryDocument>,
    @InjectModel(MediaAsset.name)
    private readonly media: Model<MediaAssetDocument>,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(input: CreateProductDto, actor: Actor) {
    const slug = normalizeSlug(input.slug ?? input.name);
    if (!slug) this.invalidSlug();
    await this.validateCategories(input.categoryIds, false);
    if (input.status === "ACTIVE") {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PRODUCT_PUBLICATION_INVALID",
        "Create the product variants before publishing.",
      );
    }
    try {
      const product = await this.products.create({
        name: input.name.trim(),
        slug,
        shortDescription: input.shortDescription?.trim() || null,
        description: input.description?.trim() || null,
        categoryIds: input.categoryIds.map((id) => objectId(id)),
        status: input.status ?? "DRAFT",
        tags: (input.tags ?? [])
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        coverMediaId: input.coverMediaId ? objectId(input.coverMediaId) : null,
        mediaIds: (input.mediaIds ?? []).map((id) => objectId(id)),
        seo: {
          title: input.seo?.title?.trim() || null,
          description: input.seo?.description?.trim() || null,
        },
        publishedAt: null,
        createdBy: objectId(actor.userId),
        updatedBy: objectId(actor.userId),
        archivedAt: null,
      });
      await this.audit.record({
        action: "product.create",
        resourceType: "Product",
        resourceId: product.id,
        actorId: actor.userId,
        requestId: actor.requestId,
        after: {
          name: product.name,
          slug: product.slug,
          status: product.status,
        },
      });
      return this.adminResponse(product);
    } catch (error) {
      this.handleDuplicate(error);
      throw error;
    }
  }

  async update(productId: string, input: UpdateProductDto, actor: Actor) {
    if (input.status === "ARCHIVED") {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "PRODUCT_STATUS_INVALID",
        "Use the archive operation to archive a product.",
      );
    }
    const product = await this.products.findById(objectId(productId));
    if (!product) this.notFound();
    if (product.status === "ARCHIVED") {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PRODUCT_ARCHIVED",
        "Archived product cannot be updated.",
      );
    }
    const before = {
      name: product.name,
      slug: product.slug,
      status: product.status,
    };
    if (input.categoryIds !== undefined)
      await this.validateCategories(
        input.categoryIds,
        input.status === "ACTIVE" || product.status === "ACTIVE",
      );
    if (input.name !== undefined) product.name = input.name.trim();
    if (input.slug !== undefined) product.slug = normalizeSlug(input.slug);
    if (input.shortDescription !== undefined)
      product.shortDescription = input.shortDescription?.trim() || null;
    if (input.description !== undefined)
      product.description = input.description?.trim() || null;
    if (input.categoryIds !== undefined)
      product.categoryIds = input.categoryIds.map((id) => objectId(id));
    if (input.tags !== undefined)
      product.tags = input.tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
    if (input.coverMediaId !== undefined)
      product.coverMediaId = input.coverMediaId
        ? objectId(input.coverMediaId)
        : null;
    if (input.mediaIds !== undefined)
      product.mediaIds = input.mediaIds.map((id) => objectId(id));
    if (input.seo !== undefined)
      product.seo = {
        title: input.seo.title?.trim() || null,
        description: input.seo.description?.trim() || null,
      };
    if (input.status !== undefined) product.status = input.status;
    if (product.status === "ACTIVE") {
      await this.assertPublishable(product);
      product.publishedAt ??= new Date();
    }
    product.updatedBy = objectId(actor.userId);
    try {
      await product.save();
      await this.audit.record({
        action:
          before.status !== product.status && product.status === "ACTIVE"
            ? "product.publish"
            : "product.update",
        resourceType: "Product",
        resourceId: product.id,
        actorId: actor.userId,
        requestId: actor.requestId,
        before,
        after: {
          name: product.name,
          slug: product.slug,
          status: product.status,
        },
      });
      return this.adminResponse(product);
    } catch (error) {
      this.handleDuplicate(error);
      throw error;
    }
  }

  async archive(productId: string, actor: Actor): Promise<void> {
    const product = await this.products.findOneAndUpdate(
      { _id: objectId(productId), status: { $ne: "ARCHIVED" } },
      {
        $set: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedBy: objectId(actor.userId),
        },
      },
      { returnDocument: "after" },
    );
    if (!product) this.notFound();
    await this.audit.record({
      action: "product.archive",
      resourceType: "Product",
      resourceId: product.id,
      actorId: actor.userId,
      requestId: actor.requestId,
      after: { status: "ARCHIVED", slug: product.slug },
    });
  }

  async listAdmin(query: ProductListQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.q?.trim())
      filter.name = { $regex: escapeRegex(query.q.trim()), $options: "i" };
    if (query.category) {
      const category = await this.categories
        .findOne({ slug: normalizeSlug(query.category) })
        .select({ _id: 1 });
      if (!category)
        return { items: [], page: query.page, limit: query.limit, total: 0 };
      filter.categoryIds = category._id;
    }
    const [items, total] = await Promise.all([
      this.products
        .find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      this.products.countDocuments(filter),
    ]);
    return {
      items: items.map((product) => this.adminResponse(product)),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  async listPublic(query: ProductListQueryDto) {
    const filter: Record<string, unknown> = {
      status: "ACTIVE",
      archivedAt: null,
    };
    if (query.q?.trim())
      filter.name = { $regex: escapeRegex(query.q.trim()), $options: "i" };
    if (query.category) {
      const category = await this.categories
        .findOne({ slug: normalizeSlug(query.category), status: "ACTIVE" })
        .select({ _id: 1 });
      if (!category)
        return { items: [], page: query.page, limit: query.limit, total: 0 };
      filter.categoryIds = category._id;
    }

    const variantFilter: Record<string, unknown> = {
      status: "ACTIVE",
      archivedAt: null,
    };
    if (query.size) variantFilter.size = query.size;
    if (query.color)
      variantFilter.color = {
        $regex: `^${escapeRegex(query.color)}$`,
        $options: "i",
      };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      variantFilter.price = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }
    const matchingVariants = await this.variants
      .find(variantFilter)
      .select({ productId: 1, lowStockThreshold: 1, _id: 1 });
    let allowedVariants = matchingVariants;
    if (query.availability) {
      const ids = matchingVariants.map((variant) => variant._id);
      const inventory = await this.inventories.find({
        variantId: { $in: ids },
      });
      const availabilityById = new Map(
        inventory.map((item) => [
          item.variantId.toString(),
          item.onHand - item.reserved,
        ]),
      );
      allowedVariants = matchingVariants.filter((variant) => {
        const available = availabilityById.get(variant.id) ?? 0;
        if (query.availability === "OUT_OF_STOCK") return available <= 0;
        if (query.availability === "LOW_STOCK") {
          return available > 0 && available <= variant.lowStockThreshold;
        }
        return available > variant.lowStockThreshold;
      });
    }
    filter._id = {
      $in: [
        ...new Set(
          allowedVariants.map((variant) => variant.productId.toString()),
        ),
      ].map((id) => objectId(id)),
    };
    const total = await this.products.countDocuments(filter);
    const products = await this.products
      .find(filter)
      .sort({ publishedAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit);
    const items = await this.enrich(products);
    return { items, page: query.page, limit: query.limit, total };
  }

  async getPublicBySlug(slug: string) {
    const product = await this.products.findOne({
      slug: normalizeSlug(slug),
      status: "ACTIVE",
      archivedAt: null,
    });
    if (!product) this.notFound();
    const [response] = await this.enrich([product]);
    if (!response) this.notFound();
    return response;
  }

  private async enrich(products: ProductDocument[]) {
    const productIds = products.map((product) => product._id);
    const variants = await this.variants.find({
      productId: { $in: productIds },
      status: "ACTIVE",
      archivedAt: null,
    });
    const inventory = await this.inventories.find({
      variantId: { $in: variants.map((variant) => variant._id) },
    });
    const mediaIds = products
      .flatMap((product) => [
        ...(product.coverMediaId ? [product.coverMediaId] : []),
        ...product.mediaIds,
      ])
      .concat(variants.flatMap((variant) => variant.mediaIds));
    const media = mediaIds.length
      ? await this.media.find({ _id: { $in: mediaIds }, archivedAt: null })
      : [];
    const mediaById = new Map(
      media.map((asset) => [
        asset.id,
        {
          id: asset.id,
          secureUrl: asset.secureUrl,
          width: asset.width,
          height: asset.height,
          altText: asset.altText,
        },
      ]),
    );
    const stock = new Map(
      inventory.map((item) => [item.variantId.toString(), item]),
    );
    const variantsByProduct = new Map<string, VariantPublic[]>();
    for (const variant of variants) {
      const item = stock.get(variant.id);
      const available = item ? item.onHand - item.reserved : 0;
      const availability: AvailabilityStatus =
        available <= 0
          ? "OUT_OF_STOCK"
          : available <= variant.lowStockThreshold
            ? "LOW_STOCK"
            : "IN_STOCK";
      const list = variantsByProduct.get(variant.productId.toString()) ?? [];
      list.push({
        id: variant.id,
        sku: variant.sku,
        color: variant.color,
        colorCode: variant.colorCode,
        size: variant.size,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        currency: "VND",
        media: variant.mediaIds
          .map((id) => mediaById.get(id.toString()))
          .filter((item) => item !== undefined),
        availability,
      });
      variantsByProduct.set(variant.productId.toString(), list);
    }
    return products.map((product) => {
      const publicVariants = variantsByProduct.get(product.id) ?? [];
      const prices = publicVariants.map((variant) => variant.price);
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        description: product.description,
        categoryIds: product.categoryIds.map(String),
        coverMedia: product.coverMediaId
          ? (mediaById.get(product.coverMediaId.toString()) ?? null)
          : null,
        media: product.mediaIds
          .map((id) => mediaById.get(id.toString()))
          .filter((item) => item !== undefined),
        tags: product.tags,
        price: {
          currency: "VND" as const,
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        },
        variants: publicVariants,
        seo: {
          title: product.seo?.title ?? null,
          description: product.seo?.description ?? null,
        },
      };
    });
  }

  private adminResponse(product: ProductDocument) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      categoryIds: product.categoryIds.map(String),
      status: product.status,
      tags: product.tags,
      coverMediaId: product.coverMediaId?.toString() ?? null,
      mediaIds: product.mediaIds.map(String),
      seo: {
        title: product.seo?.title ?? null,
        description: product.seo?.description ?? null,
      },
      publishedAt: product.publishedAt?.toISOString() ?? null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private async validateCategories(
    ids: string[],
    activeOnly: boolean,
  ): Promise<void> {
    const objectIds = ids.map((id) => objectId(id));
    const count = await this.categories.countDocuments({
      _id: { $in: objectIds },
      status: activeOnly ? "ACTIVE" : { $ne: "ARCHIVED" },
    });
    if (count !== objectIds.length) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "PRODUCT_CATEGORY_INVALID",
        "Product categories are invalid.",
      );
    }
  }

  private async assertPublishable(product: ProductDocument): Promise<void> {
    if (!product.coverMediaId || product.categoryIds.length === 0) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PRODUCT_PUBLICATION_INVALID",
        "Published product requires cover media and an active category.",
      );
    }
    await this.validateCategories(product.categoryIds.map(String), true);
    if (
      !(await this.media.exists({
        _id: product.coverMediaId,
        archivedAt: null,
        resourceType: "image",
      }))
    ) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PRODUCT_PUBLICATION_INVALID",
        "Published product requires valid cover media.",
      );
    }
    if (
      (await this.variants.countDocuments({
        productId: product._id,
        status: "ACTIVE",
        archivedAt: null,
        price: { $gte: 0 },
      })) === 0
    ) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PRODUCT_PUBLICATION_INVALID",
        "Published product requires an active valid variant.",
      );
    }
  }

  private handleDuplicate(error: unknown): void {
    if (isDuplicateKey(error)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "PRODUCT_SLUG_CONFLICT",
        "Product slug is already in use.",
      );
    }
  }
  private invalidSlug(): never {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      "PRODUCT_SLUG_INVALID",
      "Product slug is invalid.",
    );
  }
  private notFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "PRODUCT_NOT_FOUND",
      "Product was not found.",
    );
  }
}
