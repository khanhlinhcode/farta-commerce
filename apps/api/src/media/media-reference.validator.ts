import { HttpStatus } from "@nestjs/common";
import type { Model } from "mongoose";

import { objectId } from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import type { MediaResourceType } from "./media.constants";
import type { MediaAssetDocument } from "./schemas/media-asset.schema";

export async function assertActiveMediaReferences(
  assets: Model<MediaAssetDocument>,
  ids: readonly string[],
  resourceType: MediaResourceType,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  if (ids.length === 0) return;
  const uniqueIds = [...new Set(ids)];
  const count = await assets.countDocuments({
    _id: { $in: uniqueIds.map((id) => objectId(id)) },
    archivedAt: null,
    resourceType,
  });
  if (count !== uniqueIds.length) {
    throw new ApiException(HttpStatus.BAD_REQUEST, errorCode, errorMessage);
  }
}
