import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { ApiException } from "../common/api-exception";
import type { Environment } from "../config/environment";
import { MEDIA_FORMATS, type MediaResourceType } from "./media.constants";

@Injectable()
export class CloudinarySignatureService {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<Environment, true>,
  ) {}

  createUploadAuthorization(resourceType: MediaResourceType = "image") {
    const credentials = this.credentials();
    const timestamp = Math.floor(Date.now() / 1_000);
    const publicId = `farta/catalog/${resourceType}/${randomUUID()}`;
    const signature = createHash("sha256")
      .update(
        `public_id=${publicId}&timestamp=${timestamp}${credentials.secret}`,
      )
      .digest("hex");
    return {
      cloudName: credentials.cloudName,
      apiKey: credentials.apiKey,
      resourceType,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(credentials.cloudName)}/${resourceType}/upload`,
      publicId,
      timestamp,
      signature,
      signatureAlgorithm: "sha256" as const,
      maxBytes: this.config.get("CLOUDINARY_UPLOAD_MAX_BYTES", { infer: true }),
      allowedFormats: MEDIA_FORMATS[resourceType],
    };
  }

  verifyResponse(publicId: string, version: number, signature: string): void {
    const expected = createHash("sha1")
      .update(
        `public_id=${publicId}&version=${version}${this.credentials().secret}`,
      )
      .digest("hex");
    const left = Buffer.from(expected, "hex");
    const right = Buffer.from(signature, "hex");
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "MEDIA_SIGNATURE_INVALID",
        "Cloudinary upload response could not be verified.",
      );
    }
  }

  validateUrl(value: string, resourceType: MediaResourceType): void {
    const url = new URL(value);
    const cloudName = this.credentials().cloudName;
    if (
      url.protocol !== "https:" ||
      url.hostname !== "res.cloudinary.com" ||
      !url.pathname.startsWith(`/${cloudName}/${resourceType}/upload/`)
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "MEDIA_URL_INVALID",
        "Cloudinary media URL is invalid.",
      );
    }
  }

  private credentials() {
    const cloudName = this.config.get("CLOUDINARY_CLOUD_NAME", { infer: true });
    const apiKey = this.config.get("CLOUDINARY_API_KEY", { infer: true });
    const secret = this.config.get("CLOUDINARY_API_SECRET", { infer: true });
    if (!cloudName || !apiKey || !secret) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        "MEDIA_PROVIDER_UNAVAILABLE",
        "Media provider is not configured.",
      );
    }
    return { cloudName, apiKey, secret };
  }
}
