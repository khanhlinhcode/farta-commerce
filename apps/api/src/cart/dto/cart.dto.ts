import { IsInt, IsMongoId, Max, Min } from "class-validator";

export class AddCartItemDto {
  @IsMongoId()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

export class CartItemParamDto {
  @IsMongoId()
  itemId!: string;
}
