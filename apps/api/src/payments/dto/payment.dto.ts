import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export class PaymentOrderCodeParamDto {
  @IsString()
  @Matches(/^FAR-[0-9]{8}-[A-Z2-9]{10}$/)
  orderCode!: string;
}

export class SePayWebhookDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  id!: number;

  @IsString()
  @MaxLength(80)
  gateway!: string;

  @IsString()
  @Matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/)
  transactionDate!: string;

  @IsString()
  @MaxLength(80)
  accountNumber!: string;

  @IsString()
  @MaxLength(80)
  subAccount!: string;

  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(80)
  code!: string | null;

  @IsString()
  @MaxLength(500)
  content!: string;

  @IsIn(["in", "out"])
  transferType!: "in" | "out";

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  transferAmount!: number;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  accumulated!: number;

  @IsString()
  @MaxLength(160)
  referenceCode!: string;
}
