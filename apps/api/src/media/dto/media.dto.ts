import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import {
  MEDIA_FORMATS,
  MEDIA_RESOURCE_TYPES,
  type MediaResourceType,
} from "../media.constants";

export class AuthorizeMediaUploadDto {
  @IsOptional()
  @IsIn(MEDIA_RESOURCE_TYPES)
  resourceType?: MediaResourceType;
}

export class FinalizeMediaDto {
  @IsString()
  @MaxLength(500)
  @Matches(/^farta\/catalog\/(image|video)\/[a-f0-9-]+$/)
  publicId!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_000)
  secureUrl!: string;
  @IsIn(MEDIA_RESOURCE_TYPES) resourceType!: MediaResourceType;
  @IsString()
  @IsIn([...MEDIA_FORMATS.image, ...MEDIA_FORMATS.video])
  format!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(12_000) width!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12_000) height!: number;
  @Type(() => Number) @IsInt() @Min(1) bytes!: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 3 })
  @Min(0)
  @Max(86_400)
  durationSeconds?: number | null;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsString() @Matches(/^[a-f0-9]{40}$/) signature!: string;
  @IsOptional() @IsString() @MaxLength(255) originalFilename?: string | null;
  @IsOptional() @IsString() @MaxLength(500) altText?: string | null;
}

export class MediaIdParamDto {
  @IsMongoId() mediaId!: string;
}

export class MediaQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 24;

  @IsOptional()
  @IsIn(MEDIA_RESOURCE_TYPES)
  resourceType?: MediaResourceType;
}
