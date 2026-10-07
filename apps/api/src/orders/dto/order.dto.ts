import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class OrderCodeParamDto {
  @IsString()
  @Matches(/^FAR-[0-9]{8}-[A-Z2-9]{10}$/)
  orderCode!: string;
}

export class GuestOrderLookupDto extends OrderCodeParamDto {
  @IsString()
  @MaxLength(30)
  phone!: string;
}

export class OrderListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
