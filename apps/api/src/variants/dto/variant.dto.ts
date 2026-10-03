import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsHexColor,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import {
  VARIANT_STATUSES,
  type VariantStatus,
} from "../../catalog/catalog.constants";

export class CreateVariantDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  @MaxLength(80)
  sku!: string;
  @IsString() @MinLength(1) @MaxLength(80) color!: string;
  @IsOptional() @IsHexColor() colorCode?: string | null;
  @IsString() @MinLength(1) @MaxLength(40) size!: string;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) price!: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) compareAtPrice?:
    number | null;
  @IsOptional() @IsEnum(VARIANT_STATUSES) status?: VariantStatus;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsMongoId({ each: true })
  mediaIds?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) lowStockThreshold?: number;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  @MaxLength(80)
  sku?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) color?: string;
  @IsOptional() @IsHexColor() colorCode?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) size?: string;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) price?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) compareAtPrice?:
    number | null;
  @IsOptional() @IsEnum(VARIANT_STATUSES) status?: VariantStatus;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsMongoId({ each: true })
  mediaIds?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) lowStockThreshold?: number;
}

export class VariantIdParamDto {
  @IsMongoId() variantId!: string;
}
export class ProductVariantParamDto {
  @IsMongoId() productId!: string;
  @IsMongoId() variantId!: string;
}
