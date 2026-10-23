import { Inject, Injectable } from "@nestjs/common";
import type {
  AiAvailability,
  AiProductReference,
  AiToolResponse,
} from "@farta/types";

import { ProductsService } from "../products/products.service";
import type {
  ProductAvailabilityToolDto,
  SearchProductsToolDto,
} from "./dto/ai-tool.dto";
import {
  normalizeCatalogDimension,
  normalizeCatalogSize,
} from "./ai-tool-normalization";

type PublicProduct = Awaited<ReturnType<ProductsService["getPublicBySlug"]>>;

@Injectable()
export class AiToolsService {
  constructor(
    @Inject(ProductsService) private readonly products: ProductsService,
  ) {}

  async search(input: SearchProductsToolDto): Promise<AiToolResponse> {
    const result = await this.products.listPublic({
      ...(input.keyword !== undefined ? { q: input.keyword } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.size !== undefined ? { size: input.size } : {}),
      ...(input.minPrice !== undefined ? { minPrice: input.minPrice } : {}),
      ...(input.maxPrice !== undefined ? { maxPrice: input.maxPrice } : {}),
      ...(input.availability !== undefined
        ? { availability: input.availability }
        : {}),
      sort: "newest",
      page: 1,
      limit: input.limit,
    });
    return {
      tool: "search_products",
      products: result.items.map((product) => this.toReference(product)),
    };
  }

  async details(slug: string): Promise<AiToolResponse> {
    const product = await this.products.getPublicBySlug(slug);
    return {
      tool: "get_product_details",
      products: [this.toReference(product)],
    };
  }

  async availability(
    input: ProductAvailabilityToolDto,
  ): Promise<AiToolResponse> {
    const product = await this.products.getPublicBySlug(input.slug);
    const color = normalizeCatalogDimension(input.color);
    const size = normalizeCatalogSize(input.size);
    const variants = product.variants.filter(
      (variant) =>
        (!color || normalizeCatalogDimension(variant.color) === color) &&
        (!size || normalizeCatalogSize(variant.size) === size),
    );
    const variant = variants[0];

    if (variants.length !== 1 || !variant) {
      return {
        tool: "get_product_availability",
        products: [],
        availabilityResolution: {
          status: variants.length === 0 ? "NOT_FOUND" : "AMBIGUOUS",
          productSlug: product.slug,
          color,
          size,
          availability: null,
        },
      };
    }

    const narrowed = { ...product, variants };
    return {
      tool: "get_product_availability",
      products: [this.toReference(narrowed)],
      availabilityResolution: {
        status: "MATCHED",
        productSlug: product.slug,
        color,
        size,
        availability: variant.availability,
      },
    };
  }

  private toReference(product: PublicProduct): AiProductReference {
    const availability = this.overallAvailability(
      product.variants.map((variant) => variant.availability),
    );
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      imageUrl: product.coverMedia?.secureUrl ?? null,
      priceVnd: product.price.min,
      maxPriceVnd: product.price.max,
      availability,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        color: variant.color,
        colorCode: variant.colorCode,
        size: variant.size,
        priceVnd: variant.price,
        compareAtPriceVnd: variant.compareAtPrice,
        availability: variant.availability,
      })),
    };
  }

  private overallAvailability(
    variants: ReadonlyArray<AiAvailability>,
  ): AiAvailability {
    if (variants.includes("IN_STOCK")) return "IN_STOCK";
    if (variants.includes("LOW_STOCK")) return "LOW_STOCK";
    return "OUT_OF_STOCK";
  }
}
