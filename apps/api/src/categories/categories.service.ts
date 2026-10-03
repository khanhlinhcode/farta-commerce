import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model, Types } from "mongoose";

import { AuditService } from "../audit/audit.service";
import {
  escapeRegex,
  isDuplicateKey,
  normalizeSlug,
  objectId,
} from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import {
  MediaAsset,
  type MediaAssetDocument,
} from "../media/schemas/media-asset.schema";
import type {
  CategoryListQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from "./dto/category.dto";
import { Category, type CategoryDocument } from "./schemas/category.schema";

type Actor = { userId: string; requestId: string };

export type CategoryResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageMediaId: string | null;
  image?: {
    id: string;
    secureUrl: string;
    width: number;
    height: number;
    altText: string | null;
  } | null;
  parentCategoryId: string | null;
  status: Category["status"];
  sortOrder: number;
  seo: { title: string | null; description: string | null };
  createdAt?: string;
  updatedAt?: string;
};

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categories: Model<CategoryDocument>,
    @InjectModel(MediaAsset.name)
    private readonly media: Model<MediaAssetDocument>,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(
    input: CreateCategoryDto,
    actor: Actor,
  ): Promise<CategoryResponse> {
    const slug = normalizeSlug(input.slug ?? input.name);
    if (!slug) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "CATEGORY_SLUG_INVALID",
        "Category slug is invalid.",
      );
    }
    const parentCategoryId = input.parentCategoryId
      ? await this.validateParent(input.parentCategoryId)
      : null;
    try {
      const category = await this.categories.create({
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        imageMediaId: input.imageMediaId ? objectId(input.imageMediaId) : null,
        parentCategoryId,
        status: input.status ?? "DRAFT",
        sortOrder: input.sortOrder ?? 0,
        seo: {
          title: input.seo?.title?.trim() || null,
          description: input.seo?.description?.trim() || null,
        },
        createdBy: objectId(actor.userId),
        updatedBy: objectId(actor.userId),
        archivedAt: null,
      });
      await this.audit.record({
        action: "category.create",
        resourceType: "Category",
        resourceId: category.id,
        actorId: actor.userId,
        requestId: actor.requestId,
        after: {
          name: category.name,
          slug: category.slug,
          status: category.status,
        },
      });
      return this.toResponse(category, true);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "CATEGORY_SLUG_CONFLICT",
          "Category slug is already in use.",
        );
      }
      throw error;
    }
  }

  async update(
    categoryId: string,
    input: UpdateCategoryDto,
    actor: Actor,
  ): Promise<CategoryResponse> {
    if (input.status === "ARCHIVED") {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "CATEGORY_STATUS_INVALID",
        "Use the archive operation to archive a category.",
      );
    }
    const id = objectId(categoryId);
    const existing = await this.categories.findById(id).exec();
    if (!existing) this.notFound();
    if (existing.status === "ARCHIVED") {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "CATEGORY_ARCHIVED",
        "Archived category cannot be updated.",
      );
    }

    const nextParent =
      input.parentCategoryId === undefined
        ? existing.parentCategoryId
        : input.parentCategoryId
          ? await this.validateParent(input.parentCategoryId, categoryId)
          : null;
    if (nextParent) await this.assertNoCycle(id, nextParent);

    const before = {
      name: existing.name,
      slug: existing.slug,
      status: existing.status,
      parentCategoryId: existing.parentCategoryId?.toString() ?? null,
    };
    if (input.name !== undefined) existing.name = input.name.trim();
    if (input.slug !== undefined) existing.slug = normalizeSlug(input.slug);
    if (input.description !== undefined)
      existing.description = input.description?.trim() || null;
    if (input.imageMediaId !== undefined)
      existing.imageMediaId = input.imageMediaId
        ? objectId(input.imageMediaId)
        : null;
    if (input.parentCategoryId !== undefined)
      existing.parentCategoryId = nextParent;
    if (input.status !== undefined) existing.status = input.status;
    if (input.sortOrder !== undefined) existing.sortOrder = input.sortOrder;
    if (input.seo !== undefined) {
      existing.seo = {
        title: input.seo.title?.trim() || null,
        description: input.seo.description?.trim() || null,
      };
    }
    existing.updatedBy = objectId(actor.userId);

    try {
      await existing.save();
      await this.audit.record({
        action: "category.update",
        resourceType: "Category",
        resourceId: existing.id,
        actorId: actor.userId,
        requestId: actor.requestId,
        before,
        after: {
          name: existing.name,
          slug: existing.slug,
          status: existing.status,
          parentCategoryId: existing.parentCategoryId?.toString() ?? null,
        },
      });
      return this.toResponse(existing, true);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "CATEGORY_SLUG_CONFLICT",
          "Category slug is already in use.",
        );
      }
      throw error;
    }
  }

  async archive(categoryId: string, actor: Actor): Promise<void> {
    const id = objectId(categoryId);
    const hasChildren = await this.categories.exists({
      parentCategoryId: id,
      status: { $ne: "ARCHIVED" },
    });
    if (hasChildren) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "CATEGORY_HAS_DEPENDENCIES",
        "Category has active child categories.",
      );
    }
    const category = await this.categories.findOneAndUpdate(
      { _id: id, status: { $ne: "ARCHIVED" } },
      {
        $set: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedBy: objectId(actor.userId),
        },
      },
      { returnDocument: "after" },
    );
    if (!category) this.notFound();
    await this.audit.record({
      action: "category.archive",
      resourceType: "Category",
      resourceId: category.id,
      actorId: actor.userId,
      requestId: actor.requestId,
      before: { status: "non-archived" },
      after: { status: "ARCHIVED" },
    });
  }

  async listAdmin(query: CategoryListQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.q?.trim()) {
      filter.name = { $regex: escapeRegex(query.q.trim()), $options: "i" };
    }
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.categories
        .find(filter)
        .sort({ sortOrder: 1, name: 1, _id: 1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      this.categories.countDocuments(filter),
    ]);
    return {
      items: items.map((item) => this.toResponse(item, true)),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  async listPublic(): Promise<{ items: CategoryResponse[] }> {
    const items = await this.categories
      .find({ status: "ACTIVE", archivedAt: null })
      .sort({ sortOrder: 1, name: 1, _id: 1 })
      .exec();
    const media = await this.mediaMap(items);
    return {
      items: items.map((item) => this.toResponse(item, false, media)),
    };
  }

  async getPublicBySlug(slug: string): Promise<CategoryResponse> {
    const category = await this.categories
      .findOne({
        slug: normalizeSlug(slug),
        status: "ACTIVE",
        archivedAt: null,
      })
      .exec();
    if (!category) this.notFound();
    return this.toResponse(category, false, await this.mediaMap([category]));
  }

  private async validateParent(
    parentId: string,
    currentId?: string,
  ): Promise<Types.ObjectId> {
    const parent = objectId(parentId);
    if (currentId && parent.equals(objectId(currentId))) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "CATEGORY_PARENT_INVALID",
        "Category cannot be its own parent.",
      );
    }
    const exists = await this.categories.exists({
      _id: parent,
      status: { $ne: "ARCHIVED" },
    });
    if (!exists) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "CATEGORY_PARENT_INVALID",
        "Parent category is invalid.",
      );
    }
    return parent;
  }

  private async assertNoCycle(
    id: Types.ObjectId,
    parentId: Types.ObjectId,
  ): Promise<void> {
    let cursor: Types.ObjectId | null = parentId;
    for (let depth = 0; cursor && depth < 4; depth += 1) {
      if (cursor.equals(id)) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "CATEGORY_CYCLE",
          "Category hierarchy cannot contain a cycle.",
        );
      }
      const parent: { parentCategoryId?: Types.ObjectId | null } | null =
        await this.categories
          .findById(cursor)
          .select({ parentCategoryId: 1 })
          .lean()
          .exec();
      cursor = parent?.parentCategoryId ?? null;
    }
    if (cursor) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "CATEGORY_DEPTH_EXCEEDED",
        "Category hierarchy exceeds the supported depth.",
      );
    }
  }

  private toResponse(
    category: CategoryDocument,
    includeAdmin: boolean,
    media: Map<
      string,
      {
        id: string;
        secureUrl: string;
        width: number;
        height: number;
        altText: string | null;
      }
    > = new Map(),
  ): CategoryResponse {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageMediaId: category.imageMediaId?.toString() ?? null,
      ...(!includeAdmin
        ? {
            image: category.imageMediaId
              ? (media.get(category.imageMediaId.toString()) ?? null)
              : null,
          }
        : {}),
      parentCategoryId: category.parentCategoryId?.toString() ?? null,
      status: category.status,
      sortOrder: category.sortOrder,
      seo: {
        title: category.seo?.title ?? null,
        description: category.seo?.description ?? null,
      },
      ...(includeAdmin
        ? {
            createdAt: category.createdAt.toISOString(),
            updatedAt: category.updatedAt.toISOString(),
          }
        : {}),
    };
  }

  private async mediaMap(categories: CategoryDocument[]) {
    const ids = categories.flatMap((category) =>
      category.imageMediaId ? [category.imageMediaId] : [],
    );
    const assets = ids.length
      ? await this.media.find({ _id: { $in: ids }, archivedAt: null })
      : [];
    return new Map(
      assets.map((asset) => [
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
  }

  private notFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "CATEGORY_NOT_FOUND",
      "Category was not found.",
    );
  }
}
