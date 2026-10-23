import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import {
  AVAILABILITY_STATUSES,
  type AvailabilityStatus,
} from "../../catalog/catalog.constants";

export class SearchProductsToolDto {
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(80) color?: string;
  @IsOptional() @IsString() @MaxLength(40) size?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional()
  @IsEnum(AVAILABILITY_STATUSES)
  availability?: AvailabilityStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) limit = 6;
}

export class ProductDetailsToolDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug!: string;
}

export class ProductAvailabilityToolDto extends ProductDetailsToolDto {
  @IsOptional() @IsString() @MaxLength(80) color?: string;
  @IsOptional() @IsString() @MaxLength(40) size?: string;
}
