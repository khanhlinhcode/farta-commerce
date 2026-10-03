import {
  IsInt,
  IsMongoId,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class InventoryVariantParamDto {
  @IsMongoId() variantId!: string;
}

export class AdjustInventoryDto {
  @IsInt() @Min(-1_000_000) @Max(1_000_000) quantityDelta!: number;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class IdempotencyHeaderDto {
  @IsString() @MinLength(8) @MaxLength(160) idempotencyKey!: string;
}
