import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class FinalizeMediaDto {
  @IsString()
  @MaxLength(500)
  @Matches(/^farta\/catalog\/[a-f0-9-]+$/)
  publicId!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_000)
  secureUrl!: string;
  @IsIn(["image"]) resourceType!: "image";
  @IsString() @IsIn(["jpg", "jpeg", "png", "webp", "avif"]) format!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(12_000) width!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12_000) height!: number;
  @Type(() => Number) @IsInt() @Min(1) bytes!: number;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsString() @Matches(/^[a-f0-9]{40}$/) signature!: string;
  @IsOptional() @IsString() @MaxLength(255) originalFilename?: string | null;
  @IsOptional() @IsString() @MaxLength(500) altText?: string | null;
}

export class MediaIdParamDto {
  @IsMongoId() mediaId!: string;
}
