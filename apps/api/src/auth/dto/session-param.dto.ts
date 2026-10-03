import { IsMongoId } from "class-validator";

export class SessionParamDto {
  @IsMongoId()
  sessionId!: string;
}
