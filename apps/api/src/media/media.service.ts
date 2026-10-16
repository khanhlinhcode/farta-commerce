import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { Connection, Model } from "mongoose";

import { AuditService } from "../audit/audit.service";
import { isDuplicateKey, objectId } from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import { CloudinarySignatureService } from "./cloudinary-signature.service";
import type { FinalizeMediaDto } from "./dto/media.dto";
import { MEDIA_FORMATS, type MediaResourceType } from "./media.constants";
import {
  MediaAsset,
  type MediaAssetDocument,
} from "./schemas/media-asset.schema";

type Actor = { userId: string; requestId: string };

@Injectable()
export class MediaService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(MediaAsset.name)
    private readonly assets: Model<MediaAssetDocument>,
    @Inject(CloudinarySignatureService)
    private readonly cloudinary: CloudinarySignatureService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  authorizeUpload(resourceType: MediaResourceType = "image") {
    return this.cloudinary.createUploadAuthorization(resourceType);
  }

  async finalize(input: FinalizeMediaDto, actor: Actor) {
    if (!input.publicId.startsWith(`farta/catalog/${input.resourceType}/`)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "MEDIA_RESOURCE_TYPE_MISMATCH",
        "Media resource type does not match its upload authorization.",
      );
    }
    this.cloudinary.verifyResponse(
      input.publicId,
      input.version,
      input.signature,
    );
    this.cloudinary.validateUrl(input.secureUrl, input.resourceType);
    const authorization = this.cloudinary.createUploadAuthorization(
      input.resourceType,
    );
    const maxBytes = authorization.maxBytes;
    if (input.bytes > maxBytes) {
      throw new ApiException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        "MEDIA_TOO_LARGE",
        "Media exceeds the configured size limit.",
      );
    }
    const allowedFormats: readonly string[] = MEDIA_FORMATS[input.resourceType];
    if (!allowedFormats.includes(input.format.toLowerCase())) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "MEDIA_FORMAT_INVALID",
        "Media format is not allowed for this resource type.",
      );
    }
    if (
      input.resourceType === "video" &&
      typeof input.durationSeconds !== "number"
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "MEDIA_DURATION_REQUIRED",
        "Video duration is required.",
      );
    }
    const originalFilename = input.originalFilename
      ? input.originalFilename
          .split(/[\\/]/)
          .at(-1)
          ?.split("")
          .filter((character) => character.charCodeAt(0) >= 32)
          .join("")
          .slice(0, 255) || null
      : null;
    try {
      const asset = await this.assets.create({
        provider: "CLOUDINARY",
        publicId: input.publicId,
        secureUrl: input.secureUrl,
        resourceType: input.resourceType,
        format: input.format.toLowerCase(),
        width: input.width,
        height: input.height,
        bytes: input.bytes,
        durationSeconds:
          input.resourceType === "video"
            ? (input.durationSeconds ?? null)
            : null,
        originalFilename,
        altText: input.altText?.trim() || null,
        createdBy: objectId(actor.userId),
        archivedAt: null,
      });
      await this.audit.record({
        action: "media.create",
        resourceType: "MediaAsset",
        resourceId: asset.id,
        actorId: actor.userId,
        requestId: actor.requestId,
        after: {
          publicId: asset.publicId,
          format: asset.format,
          bytes: asset.bytes,
        },
      });
      return this.response(asset);
    } catch (error) {
      if (isDuplicateKey(error)) {
        const existing = await this.assets.findOne({
          publicId: input.publicId,
        });
        if (existing) return this.response(existing);
      }
      throw error;
    }
  }

  async list() {
    const items = await this.assets
      .find({ archivedAt: null })
      .sort({ createdAt: -1 })
      .limit(100);
    return { items: items.map((asset) => this.response(asset)) };
  }

  async archive(mediaId: string, actor: Actor): Promise<void> {
    const id = objectId(mediaId);
    const collections: Array<readonly [string, unknown]> = [
      ["products", { $or: [{ coverMediaId: id }, { mediaIds: id }] }],
      ["product_variants", { mediaIds: id }],
      ["categories", { imageMediaId: id }],
      [
        "banners",
        {
          $or: [
            { desktopMediaId: id },
            { mobileMediaId: id },
            { desktopVideoMediaId: id },
            { mobileVideoMediaId: id },
          ],
        },
      ],
    ];
    for (const [collection, filter] of collections) {
      if (
        await this.connection.collection(collection).findOne(filter as never)
      ) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "MEDIA_IN_USE",
          "Media is referenced and cannot be archived.",
        );
      }
    }
    const asset = await this.assets.findOneAndUpdate(
      { _id: id, archivedAt: null },
      { $set: { archivedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!asset)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "MEDIA_NOT_FOUND",
        "Media was not found.",
      );
    await this.audit.record({
      action: "media.archive",
      resourceType: "MediaAsset",
      resourceId: asset.id,
      actorId: actor.userId,
      requestId: actor.requestId,
      after: { archivedAt: asset.archivedAt?.toISOString() ?? null },
    });
  }

  private response(asset: MediaAssetDocument) {
    return {
      id: asset.id,
      provider: asset.provider,
      publicId: asset.publicId,
      secureUrl: asset.secureUrl,
      resourceType: asset.resourceType,
      format: asset.format,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      durationSeconds: asset.durationSeconds ?? null,
      originalFilename: asset.originalFilename,
      altText: asset.altText,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
