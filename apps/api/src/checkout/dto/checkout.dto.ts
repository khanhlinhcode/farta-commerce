import { Transform } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") return value;
  const result = value.trim();
  return result === "" ? undefined : result;
};

export class CheckoutPreviewDto {}

export class SubmitCheckoutDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  recipientName!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone!: string;

  @Transform(trim)
  @IsString()
  @Length(5, 300)
  addressLine!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  provinceCity!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ward?: string;

  @IsIn(["STANDARD"])
  shippingMethod!: "STANDARD";

  @IsIn(["COD"])
  paymentMethod!: "COD";

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsString()
  @Length(64, 64)
  @Matches(/^[a-f0-9]{64}$/)
  quoteToken!: string;
}
