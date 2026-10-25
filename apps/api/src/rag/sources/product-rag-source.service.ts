import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import {
  Category,
  type CategoryDocument,
} from "../../categories/schemas/category.schema";
import {
  Product,
  type ProductDocument,
} from "../../products/schemas/product.schema";
import { ragDigest } from "../rag-identifiers";
import type { RagSourceDocument } from "../rag.types";

@Injectable()
export class ProductRagSourceService {
  constructor(
    @InjectModel(Product.name)
    private readonly products: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categories: Model<CategoryDocument>,
  ) {}

  async listPublicSources(): Promise<RagSourceDocument[]> {
    const products = await this.products
      .find({ status: "ACTIVE", archivedAt: null })
      .sort({ _id: 1 })
      .exec();
    const categoryIds = [
      ...new Set(
        products.flatMap((product) => product.categoryIds.map(String)),
      ),
    ];
    const categories = categoryIds.length
      ? await this.categories
          .find({
            _id: { $in: categoryIds },
          })
          .select({ name: 1, status: 1, archivedAt: 1, updatedAt: 1 })
          .exec()
      : [];
    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );

    return products.map((product) => {
      const referencedCategories = product.categoryIds.map((id) => {
        const category = categoriesById.get(id.toString());
        return category
          ? {
              id: category.id,
              name: category.name,
              status: category.status,
              archivedAt: category.archivedAt?.toISOString() ?? null,
              updatedAt: category.updatedAt.toISOString(),
            }
          : { id: id.toString(), missing: true as const };
      });
      const names = referencedCategories.flatMap((category) =>
        "name" in category &&
        category.status === "ACTIVE" &&
        category.archivedAt === null
          ? [category.name]
          : [],
      );
      const categorySection = names.length
        ? `Danh mục: ${names.join(", ")}`
        : "";
      const tagSection = product.tags.length
        ? `Thuộc tính công khai: ${product.tags.join(", ")}`
        : "";
      const contentSections = [
        product.name,
        product.shortDescription ?? "",
        product.description ?? "",
        categorySection,
        tagSection,
      ];
      const sourceUpdatedAt = new Date(
        Math.max(
          product.updatedAt.getTime(),
          ...categories.map((category) => category.updatedAt.getTime()),
        ),
      );
      const sourceVersion = `rag-product-v1:${ragDigest(
        JSON.stringify({
          title: product.name,
          canonicalPath: `/product/${product.slug}`,
          contentSections,
          metadata: {
            productSlug: product.slug,
            categoryIds: product.categoryIds.map(String),
            tags: [...product.tags],
          },
          referencedCategories,
        }),
      )}`;
      return {
        tenantId: "farta",
        sourceType: "PRODUCT",
        sourceId: product.slug,
        locale: "vi",
        title: product.name,
        canonicalPath: `/product/${product.slug}`,
        contentSections,
        sourceVersion,
        sourceUpdatedAt,
        publishedAt: product.publishedAt,
        metadata: {
          productSlug: product.slug,
          categoryIds: product.categoryIds.map(String),
          tags: [...product.tags],
        },
      };
    });
  }
}
