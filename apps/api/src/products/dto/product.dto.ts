import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import {
  AVAILABILITY_STATUSES,
  CATALOG_STATUSES,
  type AvailabilityStatus,
  type CatalogStatus,
} from "../../catalog/catalog.constants";

export class ProductSeoDto {
  @IsOptional() @IsString() @MaxLength(70) title?: string | null;
  @IsOptional() @IsString() @MaxLength(160) description?: string | null;
}

export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;
  @IsOptional() @IsString() @MaxLength(500) shortDescription?: string | null;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string | null;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsMongoId({ each: true })
  categoryIds!: string[];
  @IsOptional() @IsEnum(CATALOG_STATUSES) status?: CatalogStatus;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
  @IsOptional() @IsMongoId() coverMediaId?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsMongoId({ each: true })
  mediaIds?: string[];
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductSeoDto)
  seo?: ProductSeoDto;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;
  @IsOptional() @IsString() @MaxLength(500) shortDescription?: string | null;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsMongoId({ each: true })
  categoryIds?: string[];
  @IsOptional() @IsEnum(CATALOG_STATUSES) status?: CatalogStatus;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
  @IsOptional() @IsMongoId() coverMediaId?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsMongoId({ each: true })
  mediaIds?: string[];
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductSeoDto)
  seo?: ProductSeoDto;
}

export class ProductIdParamDto {
  @IsMongoId() productId!: string;
}
export class ProductSlugParamDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
}

export class ProductListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(40) size?: string;
  @IsOptional() @IsString() @MaxLength(80) color?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional()
  @IsEnum(AVAILABILITY_STATUSES)
  availability?: AvailabilityStatus;
  @IsOptional() @IsEnum(["newest"]) sort = "newest" as const;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 24;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @IsEnum(CATALOG_STATUSES) status?: CatalogStatus;
}
