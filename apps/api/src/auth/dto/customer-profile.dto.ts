import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateCustomerProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;
}
