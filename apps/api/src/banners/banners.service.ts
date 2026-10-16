import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { AuditService } from "../audit/audit.service";
import { objectId } from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import {
  MediaAsset,
  type MediaAssetDocument,
} from "../media/schemas/media-asset.schema";
import type { CreateBannerDto, UpdateBannerDto } from "./dto/banner.dto";
import { Banner, type BannerDocument } from "./schemas/banner.schema";

type Actor = { userId: string; requestId: string };

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name) private readonly banners: Model<BannerDocument>,
    @InjectModel(MediaAsset.name)
    private readonly media: Model<MediaAssetDocument>,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(input: CreateBannerDto, actor: Actor) {
    this.validateSchedule(input.startAt ?? null, input.endAt ?? null);
    this.validateCta(input.ctaTarget ?? null);
    await this.validateMedia(
      input.desktopMediaId,
      input.mobileMediaId ?? null,
      input.desktopVideoMediaId ?? null,
      input.mobileVideoMediaId ?? null,
    );
    if (input.status === "ARCHIVED") this.invalidStatus();
    const banner = await this.banners.create({
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      desktopMediaId: objectId(input.desktopMediaId),
      mobileMediaId: input.mobileMediaId ? objectId(input.mobileMediaId) : null,
      desktopVideoMediaId: input.desktopVideoMediaId
        ? objectId(input.desktopVideoMediaId)
        : null,
      mobileVideoMediaId: input.mobileVideoMediaId
        ? objectId(input.mobileVideoMediaId)
        : null,
      ctaLabel: input.ctaLabel?.trim() || null,
      ctaTarget: input.ctaTarget?.trim() || null,
      position: input.position.trim().toLowerCase(),
      priority: input.priority ?? 0,
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      status: input.status ?? "DRAFT",
      createdBy: objectId(actor.userId),
      updatedBy: objectId(actor.userId),
      archivedAt: null,
    });
    await this.audit.record({
      action: banner.status === "ACTIVE" ? "banner.publish" : "banner.create",
      resourceType: "Banner",
      resourceId: banner.id,
      actorId: actor.userId,
      requestId: actor.requestId,
      after: {
        title: banner.title,
        status: banner.status,
        position: banner.position,
      },
    });
    return this.response(banner, await this.mediaMap(banner));
  }

  async update(bannerId: string, input: UpdateBannerDto, actor: Actor) {
    if (input.status === "ARCHIVED") this.invalidStatus();
    const banner = await this.banners.findById(objectId(bannerId));
    if (!banner) this.notFound();
    if (banner.status === "ARCHIVED") {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "BANNER_ARCHIVED",
        "Archived banner cannot be updated.",
      );
    }
    const startAt =
      input.startAt === undefined ? banner.startAt : input.startAt;
    const endAt = input.endAt === undefined ? banner.endAt : input.endAt;
    this.validateSchedule(startAt, endAt);
    this.validateCta(
      input.ctaTarget === undefined ? banner.ctaTarget : input.ctaTarget,
    );
    const desktopMediaId =
      input.desktopMediaId ?? banner.desktopMediaId.toString();
    const mobileMediaId =
      input.mobileMediaId === undefined
        ? (banner.mobileMediaId?.toString() ?? null)
        : input.mobileMediaId;
    const desktopVideoMediaId =
      input.desktopVideoMediaId === undefined
        ? (banner.desktopVideoMediaId?.toString() ?? null)
        : input.desktopVideoMediaId;
    const mobileVideoMediaId =
      input.mobileVideoMediaId === undefined
        ? (banner.mobileVideoMediaId?.toString() ?? null)
        : input.mobileVideoMediaId;
    await this.validateMedia(
      desktopMediaId,
      mobileMediaId,
      desktopVideoMediaId,
      mobileVideoMediaId,
    );
    const before = {
      title: banner.title,
      status: banner.status,
      priority: banner.priority,
    };
    if (input.title !== undefined) banner.title = input.title.trim();
    if (input.subtitle !== undefined)
      banner.subtitle = input.subtitle?.trim() || null;
    if (input.desktopMediaId !== undefined)
      banner.desktopMediaId = objectId(input.desktopMediaId);
    if (input.mobileMediaId !== undefined)
      banner.mobileMediaId = input.mobileMediaId
        ? objectId(input.mobileMediaId)
        : null;
    if (input.desktopVideoMediaId !== undefined)
      banner.desktopVideoMediaId = input.desktopVideoMediaId
        ? objectId(input.desktopVideoMediaId)
        : null;
    if (input.mobileVideoMediaId !== undefined)
      banner.mobileVideoMediaId = input.mobileVideoMediaId
        ? objectId(input.mobileVideoMediaId)
        : null;
    if (input.ctaLabel !== undefined)
      banner.ctaLabel = input.ctaLabel?.trim() || null;
    if (input.ctaTarget !== undefined)
      banner.ctaTarget = input.ctaTarget?.trim() || null;
    if (input.position !== undefined)
      banner.position = input.position.trim().toLowerCase();
    if (input.priority !== undefined) banner.priority = input.priority;
    if (input.startAt !== undefined) banner.startAt = input.startAt;
    if (input.endAt !== undefined) banner.endAt = input.endAt;
    if (input.status !== undefined) banner.status = input.status;
    banner.updatedBy = objectId(actor.userId);
    await banner.save();
    await this.audit.record({
      action:
        before.status !== banner.status && banner.status === "ACTIVE"
          ? "banner.publish"
          : "banner.update",
      resourceType: "Banner",
      resourceId: banner.id,
      actorId: actor.userId,
      requestId: actor.requestId,
      before,
      after: {
        title: banner.title,
        status: banner.status,
        priority: banner.priority,
      },
    });
    return this.response(banner, await this.mediaMap(banner));
  }

  async archive(bannerId: string, actor: Actor): Promise<void> {
    const banner = await this.banners.findOneAndUpdate(
      { _id: objectId(bannerId), status: { $ne: "ARCHIVED" } },
      {
        $set: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedBy: objectId(actor.userId),
        },
      },
      { returnDocument: "after" },
    );
    if (!banner) this.notFound();
    await this.audit.record({
      action: "banner.archive",
      resourceType: "Banner",
      resourceId: banner.id,
      actorId: actor.userId,
      requestId: actor.requestId,
      after: { status: "ARCHIVED" },
    });
  }

  async listAdmin() {
    const banners = await this.banners
      .find()
      .sort({ position: 1, priority: -1, createdAt: -1 });
    const media = await this.mediaMap(...banners);
    return { items: banners.map((banner) => this.response(banner, media)) };
  }

  async listPublic(position?: string) {
    const now = new Date();
    const filter: Record<string, unknown> = {
      status: "ACTIVE",
      archivedAt: null,
      $and: [
        { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $gt: now } }] },
      ],
    };
    if (position?.trim()) filter.position = position.trim().toLowerCase();
    const banners = await this.banners
      .find(filter)
      .sort({ priority: -1, _id: 1 });
    const media = await this.mediaMap(...banners);
    return {
      items: banners
        .filter((banner) => media.has(banner.desktopMediaId.toString()))
        .map((banner) => this.response(banner, media, true)),
    };
  }

  private async validateMedia(
    desktopId: string,
    mobileId: string | null,
    desktopVideoId: string | null,
    mobileVideoId: string | null,
  ): Promise<void> {
    const imageIds = [desktopId, ...(mobileId ? [mobileId] : [])];
    const videoIds = [
      ...(desktopVideoId ? [desktopVideoId] : []),
      ...(mobileVideoId ? [mobileVideoId] : []),
    ];
    const ids = [...imageIds, ...videoIds].map((id) => objectId(id));
    const assets = await this.media.find({
      _id: { $in: ids },
      archivedAt: null,
    });
    const resourceTypes = new Map(
      assets.map((asset) => [asset.id, asset.resourceType]),
    );
    const imagesValid = imageIds.every(
      (id) => resourceTypes.get(id) === "image",
    );
    const videosValid = videoIds.every(
      (id) => resourceTypes.get(id) === "video",
    );
    if (!imagesValid || !videosValid) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "BANNER_MEDIA_INVALID",
        "Banner media is invalid.",
      );
    }
  }

  private validateCta(value: string | null): void {
    if (value === null) return;
    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      value.includes("\\") ||
      [...value].some((character) => character.charCodeAt(0) < 32)
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "BANNER_CTA_UNSAFE",
        "Banner CTA must be a safe internal path.",
      );
    }
  }

  private validateSchedule(startAt: Date | null, endAt: Date | null): void {
    if (startAt && endAt && endAt <= startAt) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "INVALID_BANNER_SCHEDULE",
        "Banner end time must be after its start time.",
      );
    }
  }

  private async mediaMap(...banners: BannerDocument[]) {
    const ids = banners.flatMap((banner) => [
      banner.desktopMediaId,
      ...(banner.mobileMediaId ? [banner.mobileMediaId] : []),
      ...(banner.desktopVideoMediaId ? [banner.desktopVideoMediaId] : []),
      ...(banner.mobileVideoMediaId ? [banner.mobileVideoMediaId] : []),
    ]);
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
          resourceType: asset.resourceType,
          format: asset.format,
          bytes: asset.bytes,
          durationSeconds: asset.durationSeconds ?? null,
        },
      ]),
    );
  }

  private response(
    banner: BannerDocument,
    media: Map<
      string,
      {
        id: string;
        secureUrl: string;
        width: number;
        height: number;
        altText: string | null;
        resourceType: "image" | "video";
        format: string;
        bytes: number;
        durationSeconds: number | null;
      }
    >,
    publicOnly = false,
  ) {
    return {
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      desktopMedia: media.get(banner.desktopMediaId.toString()) ?? null,
      mobileMedia: banner.mobileMediaId
        ? (media.get(banner.mobileMediaId.toString()) ?? null)
        : null,
      desktopVideo: banner.desktopVideoMediaId
        ? (media.get(banner.desktopVideoMediaId.toString()) ?? null)
        : null,
      mobileVideo: banner.mobileVideoMediaId
        ? (media.get(banner.mobileVideoMediaId.toString()) ?? null)
        : null,
      ctaLabel: banner.ctaLabel,
      ctaTarget: banner.ctaTarget,
      position: banner.position,
      priority: banner.priority,
      startAt: banner.startAt?.toISOString() ?? null,
      endAt: banner.endAt?.toISOString() ?? null,
      ...(publicOnly
        ? {}
        : {
            status: banner.status,
            createdAt: banner.createdAt.toISOString(),
            updatedAt: banner.updatedAt.toISOString(),
          }),
    };
  }

  private invalidStatus(): never {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      "BANNER_STATUS_INVALID",
      "Use the archive operation to archive a banner.",
    );
  }
  private notFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "BANNER_NOT_FOUND",
      "Banner was not found.",
    );
  }
}
