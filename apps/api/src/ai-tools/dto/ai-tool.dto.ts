import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import {
  AVAILABILITY_STATUSES,
  type AvailabilityStatus,
} from "../../catalog/catalog.constants";
import {
  RAG_LOCALES,
  RAG_SOURCE_TYPES,
  type RagLocale,
  type RagSourceType,
} from "../../rag/rag.constants";

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

export class SearchKnowledgeToolDto {
  @IsString() @MinLength(2) @MaxLength(300) query!: string;

  @IsIn(RAG_LOCALES)
  locale: RagLocale = "vi";

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(RAG_SOURCE_TYPES.length)
  @IsIn(RAG_SOURCE_TYPES, { each: true })
  sourceTypes!: RagSourceType[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  tags?: string[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(8) limit = 5;
}
