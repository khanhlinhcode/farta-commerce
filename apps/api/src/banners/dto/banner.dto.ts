import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import {
  CATALOG_STATUSES,
  type CatalogStatus,
} from "../../catalog/catalog.constants";

export class CreateBannerDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(500) subtitle?: string | null;
  @IsMongoId() desktopMediaId!: string;
  @IsOptional() @IsMongoId() mobileMediaId?: string | null;
  @IsOptional() @IsMongoId() desktopVideoMediaId?: string | null;
  @IsOptional() @IsMongoId() mobileVideoMediaId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) ctaLabel?: string | null;
  @IsOptional() @IsString() @MaxLength(500) ctaTarget?: string | null;
  @IsString() @MinLength(1) @MaxLength(80) position!: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  priority?: number;
  @IsOptional() @Type(() => Date) @IsDate() startAt?: Date | null;
  @IsOptional() @Type(() => Date) @IsDate() endAt?: Date | null;
  @IsOptional() @IsEnum(CATALOG_STATUSES) status?: CatalogStatus;
}

export class UpdateBannerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(500) subtitle?: string | null;
  @IsOptional() @IsMongoId() desktopMediaId?: string;
  @IsOptional() @IsMongoId() mobileMediaId?: string | null;
  @IsOptional() @IsMongoId() desktopVideoMediaId?: string | null;
  @IsOptional() @IsMongoId() mobileVideoMediaId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) ctaLabel?: string | null;
  @IsOptional() @IsString() @MaxLength(500) ctaTarget?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) position?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  priority?: number;
  @IsOptional() @Type(() => Date) @IsDate() startAt?: Date | null;
  @IsOptional() @Type(() => Date) @IsDate() endAt?: Date | null;
  @IsOptional() @IsEnum(CATALOG_STATUSES) status?: CatalogStatus;
}

export class BannerIdParamDto {
  @IsMongoId() bannerId!: string;
}
export class BannerQueryDto {
  @IsOptional() @IsString() @MaxLength(80) position?: string;
}
