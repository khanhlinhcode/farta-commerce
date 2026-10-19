import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class AiChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1_000)
  @Matches(/^[\p{L}\p{M}\p{N}\p{P}\p{Z}\p{S}]+$/u)
  message!: string;

  @IsOptional() @IsUUID("4") conversationId?: string | null;
}
