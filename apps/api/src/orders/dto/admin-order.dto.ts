import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

import { PAYMENT_STATUSES } from "../../payments/payment-status";
import { ORDER_STATUSES } from "../schemas/order.schema";

export class AdminOrderListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  q?: string;

  @IsOptional()
  @IsEnum(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @IsOptional()
  @IsEnum(PAYMENT_STATUSES)
  paymentStatus?: (typeof PAYMENT_STATUSES)[number];

  @IsOptional()
  @IsEnum(["COD", "DEPOSIT", "FULL"])
  paymentMethod?: "COD" | "DEPOSIT" | "FULL";

  @IsOptional()
  @IsISO8601({ strict: true })
  dateFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsEnum(["newest", "oldest"])
  sort: "newest" | "oldest" = "newest";
}

export class AdminOrderCodeParamDto {
  @IsString()
  @Matches(/^FAR-[0-9]{8}-[A-Z2-9]{10}$/)
  orderCode!: string;
}

export class TransitionOrderDto {
  @IsEnum(ORDER_STATUSES)
  status!: (typeof ORDER_STATUSES)[number];

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class CancelOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ReconcilePaymentDto {
  @IsEnum(["START_REFUND", "CONFIRM_REFUNDED"])
  action!: "START_REFUND" | "CONFIRM_REFUNDED";

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ValidateIf(
    (input: ReconcilePaymentDto) => input.action === "CONFIRM_REFUNDED",
  )
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  externalReference?: string;
}
